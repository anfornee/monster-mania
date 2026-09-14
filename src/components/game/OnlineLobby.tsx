import { useEffect, useRef, useState } from 'react'
import type { GameAction, GameState } from '../../game/engine/types'
import { subscribeToAppForeground } from '../../game/network/firebase/appLifecycle'
import {
	ensureMultiplayerIdentity,
	type MultiplayerIdentity,
} from '../../game/network/firebase/multiplayerIdentity'
import {
	getOnlineTableClient,
	type OnlineTableClient,
} from '../../game/network/firebase/firestoreTableClient'
import { OnlineTableError, type OnlineTableSession } from '../../game/network/firebase/onlineTable'
import { withOnlineRequestTimeout } from '../../game/network/firebase/onlineRequestTimeout'
import type { OnlineGameSnapshot } from '../../game/network/onlineGame'
import { getGameAnnouncement } from '../../game/presentation/announcements'
import type { GamePresentationStep } from '../../game/presentation/presentationSequence'
import {
	clearOnlineTableSession,
	loadOnlineTableSession,
	saveOnlineTableSession,
} from '../../game/network/firebase/tableSessionStorage'
import { normalizeTableCode } from '../../game/network/tableCode'
import { normalizePlayerName, savePlayerName, validatePlayerName } from '../../game/presentation/playerProfile'
import { GameBoard } from './GameBoard'

interface OnlineLobbyProps {
	initialPlayerName: string
	onBack: () => void
	identityProvider?: () => Promise<MultiplayerIdentity>
	clientProvider?: () => Promise<OnlineTableClient>
}

function messageFor(error: unknown): string {
	return error instanceof OnlineTableError
		? error.message
		: 'The Online Table service could not complete that request.'
}

function presentationStepsForOnlineSnapshot(
	snapshot: OnlineGameSnapshot,
	previous: GameState | null,
	localPlayerId: string,
): GamePresentationStep[] {
	const steps: GamePresentationStep[] = []
	const event = snapshot.event
	if (event && event.actorPlayerId !== localPlayerId && event.revealedCardDefinitionIds.length > 0) {
		const actor = snapshot.state.players.find((player) => player.id === event.actorPlayerId)
		steps.push({
			type: 'opponent-card',
			card: {
				id: event.id,
				kind: event.kind ?? 'played',
				playerName: actor?.name ?? 'Opponent',
				cardDefinitionIds: event.revealedCardDefinitionIds,
			},
		})
	}
	const announcement = getGameAnnouncement(
		snapshot.state.events,
		previous?.events.at(-1)?.id ?? snapshot.state.events.at(-1)?.id ?? 0,
	)
	if (announcement) steps.push({ type: 'announcement', announcement })
	return steps
}

function OnlineMatch({
	session,
	uid,
	client,
	onBack,
	onForget,
	onReturnToMenu,
}: {
	session: OnlineTableSession
	uid: string
	client: OnlineTableClient
	onBack: () => void
	onForget: () => void
	onReturnToMenu: () => void
}) {
	const [snapshot, setSnapshot] = useState<OnlineGameSnapshot | null>(null)
	const [pending, setPending] = useState(false)
	const [rematchPending, setRematchPending] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [presentation, setPresentation] = useState<GamePresentationStep[]>([])
	const [listenerGeneration, setListenerGeneration] = useState(0)
	const previousState = useRef<GameState | null>(null)
	const lastRevision = useRef(-1)

	useEffect(() => subscribeToAppForeground(
		() => setListenerGeneration((generation) => generation + 1),
	), [])

	useEffect(() => {
		let active = true
		void withOnlineRequestTimeout(
			client.initializeGame(session.table.id),
			'The match is taking too long to initialize. Reopen the Table to reconnect.',
		).catch((initializationError) => {
			if (active) setError(messageFor(initializationError))
		})
		const unsubscribe = client.watchGame(
			session.table.id,
			uid,
			(next) => {
				if (next.revision <= lastRevision.current) return
				const steps = presentationStepsForOnlineSnapshot(next, previousState.current, uid)
				lastRevision.current = next.revision
				previousState.current = next.state
				setSnapshot(next)
				setPresentation(steps)
				setPending(false)
				setError(null)
			},
			(nextError) => setError(nextError.message),
		)
		return () => {
			active = false
			unsubscribe()
		}
	}, [client, listenerGeneration, session.table.id, uid])

	const submit = async (action: GameAction) => {
		if (!snapshot || pending) return
		setPending(true)
		setError(null)
		try {
			await withOnlineRequestTimeout(
				client.submitAction(session.table.id, snapshot.revision, action),
				'The Table did not respond. Check your connection and try again.',
			)
		} catch (submissionError) {
			setPending(false)
			setError(messageFor(submissionError))
		}
	}

	const requestRematch = async () => {
		if (rematchPending || session.table.rematchRequests[session.role]) return
		setRematchPending(true)
		setError(null)
		try {
			await withOnlineRequestTimeout(
				client.requestRematch(session.table.id),
				'The rematch request timed out. Check your connection and try again.',
			)
		} catch (requestError) {
			setError(messageFor(requestError))
		} finally {
			setRematchPending(false)
		}
	}

	if (!snapshot) {
		return (
			<main className="online-shell">
				<button type="button" className="back-button" onClick={onBack}>&larr; Tavern</button>
				<section className="online-panel online-table-status" aria-live="polite">
					<span className="eyebrow">Online Table &middot; {session.role === 'host' ? 'Player 1' : 'Player 2'}</span>
					<h1>Preparing the hunt&hellip;</h1>
					<p>The server is shuffling the decks and dealing each private hand.</p>
					{error ? <p className="field-error" role="alert">{error}</p> : null}
				</section>
			</main>
		)
	}

	return (
		<div className="game-shell">
			<nav className="game-topbar" aria-label="Match navigation">
				<button type="button" className="back-button" onClick={onBack}>&larr; Tavern</button>
				<strong>Online Table &middot; {session.table.joinCode}</strong>
				<button type="button" onClick={onForget}>Forget Table</button>
			</nav>
			{pending ? <div className="online-request-status" role="status">Waiting for the Table&hellip;</div> : null}
			{error ? <div className="error-banner" role="alert">{error}</div> : null}
			<GameBoard
				state={snapshot.state}
				localPlayerId={uid}
				onAction={(action) => void submit(action)}
				onRequestRematch={() => void requestRematch()}
				rematchRequested={session.table.rematchRequests[session.role]}
				opponentRematchRequested={session.table.rematchRequests[session.role === 'host' ? 'guest' : 'host']}
				rematchPending={rematchPending}
				actionsResolving={pending || presentation.length > 0}
				presentationStep={presentation[0] ?? null}
				onPresentationComplete={() => setPresentation((current) => current.slice(1))}
				onReturnToMenu={onReturnToMenu}
			/>
		</div>
	)
}

export function OnlineLobby({
	initialPlayerName,
	onBack,
	identityProvider = ensureMultiplayerIdentity,
	clientProvider = getOnlineTableClient,
}: OnlineLobbyProps) {
	const [storedSession] = useState(() => (
		typeof window === 'undefined' ? null : loadOnlineTableSession(window.localStorage)
	))
	const [playerName, setPlayerName] = useState(initialPlayerName)
	const [joinCode, setJoinCode] = useState('')
	const [session, setSession] = useState<OnlineTableSession | null>(null)
	const [identity, setIdentity] = useState<MultiplayerIdentity | null>(null)
	const [client, setClient] = useState<OnlineTableClient | null>(null)
	const [busyMessage, setBusyMessage] = useState<string | null>(
		storedSession ? 'Restoring your Table…' : null,
	)
	const [error, setError] = useState<string | null>(null)
	const [listenerGeneration, setListenerGeneration] = useState(0)

	useEffect(() => subscribeToAppForeground(
		() => setListenerGeneration((generation) => generation + 1),
	), [])

	useEffect(() => {
		if (!storedSession) return
		let active = true
		const restoreRequest = async () => {
			const [restoredIdentity, restoredClient] = await Promise.all([identityProvider(), clientProvider()])
			const restored = await restoredClient.resumeTable(restoredIdentity.uid, storedSession.tableId)
			return { restoredIdentity, restoredClient, restored }
		}
		void withOnlineRequestTimeout(
			restoreRequest(),
			'Restoring the Table timed out. Check your connection and try again.',
		)
			.then(({ restoredIdentity, restoredClient, restored }) => {
				if (!active) return
				setIdentity(restoredIdentity)
				setClient(restoredClient)
				setSession(restored)
				setError(null)
			})
			.catch((restoreError) => {
				if (!active) return
				clearOnlineTableSession(window.localStorage)
				setError(messageFor(restoreError))
			})
			.finally(() => {
				if (active) setBusyMessage(null)
			})
		return () => {
			active = false
		}
	}, [clientProvider, identityProvider, storedSession])

	const watchedTableId = session?.table.id
	useEffect(() => {
		if (!client || !identity || !watchedTableId) return
		return client.watchTable(
			watchedTableId,
			identity.uid,
			(nextSession) => {
				setSession(nextSession)
				setError(null)
			},
			(watchError) => setError(watchError.message),
		)
	}, [client, identity, listenerGeneration, watchedTableId])

	const establishSession = async (
		busy: string,
		operation: (tableClient: OnlineTableClient, uid: string, name: string) => Promise<OnlineTableSession>,
		timeoutMessage?: string,
	) => {
		const nameError = validatePlayerName(playerName)
		if (nameError) {
			setError(nameError)
			return
		}
		setBusyMessage(busy)
		setError(null)
		try {
			const sessionRequest = async () => {
				const [nextIdentity, nextClient] = await Promise.all([identityProvider(), clientProvider()])
				const normalizedName = normalizePlayerName(playerName)
				const nextSession = await operation(nextClient, nextIdentity.uid, normalizedName)
				return { nextIdentity, nextClient, nextSession, normalizedName }
			}
			const result = timeoutMessage
				? await withOnlineRequestTimeout(sessionRequest(), timeoutMessage)
				: await sessionRequest()
			const { nextIdentity, nextClient, nextSession, normalizedName } = result
			savePlayerName(window.localStorage, normalizedName)
			saveOnlineTableSession(window.localStorage, {
				tableId: nextSession.table.id,
				joinCode: nextSession.table.joinCode,
			})
			setIdentity(nextIdentity)
			setClient(nextClient)
			setSession(nextSession)
		} catch (operationError) {
			setError(messageFor(operationError))
		} finally {
			setBusyMessage(null)
		}
	}

	if (session) {
		const table = session.table
		const forgetTable = () => {
			clearOnlineTableSession(window.localStorage)
			setSession(null)
			setIdentity(null)
			setClient(null)
		}
		const returnToMenu = () => {
			forgetTable()
			onBack()
		}
		if (table.status !== 'waiting' && identity && client) {
			return (
				<OnlineMatch
					session={session}
					uid={identity.uid}
					client={client}
					onBack={onBack}
					onForget={forgetTable}
					onReturnToMenu={returnToMenu}
				/>
			)
		}
		return (
			<main className="online-shell">
				<button type="button" className="back-button" onClick={onBack}>← Tavern</button>
				<section className="online-panel online-table-status" aria-labelledby="online-table-title">
					<span className="eyebrow">Online Table · {session.role === 'host' ? 'Player 1' : 'Player 2'}</span>
					<h1 id="online-table-title">{table.status === 'waiting' ? 'Waiting for another hunter.' : 'Both hunters are seated.'}</h1>
					<div className="join-code-display" aria-label={`Table code ${table.joinCode}`}>
						<span>Table code</span>
						<strong>{table.joinCode}</strong>
					</div>
					<div className="online-seats" aria-label="Table seats">
						<div className="occupied"><span>Player 1 · Host</span><strong>{table.hostName}</strong></div>
						<div className={table.guestName ? 'occupied' : 'waiting'}>
							<span>Player 2 · Guest</span>
							<strong>{table.guestName ?? 'Waiting…'}</strong>
						</div>
					</div>
					<p className="online-status-copy" role="status" aria-live="polite">
						{table.status === 'waiting'
							? 'Share this code with Player 2. This page updates as soon as the seat is claimed.'
							: 'Both hunters are seated. The server is preparing the match.'}
					</p>
					{error ? <p className="field-error" role="alert">{error}</p> : null}
					<div className="setup-actions">
						<button type="button" className="secondary-button" onClick={onBack}>Return to tavern</button>
						<button type="button" className="forget-table-button" onClick={forgetTable}>Forget this Table</button>
					</div>
				</section>
			</main>
		)
	}

	return (
		<main className="online-shell">
			<button type="button" className="back-button" onClick={onBack}>← Tavern</button>
			<section className="online-panel" aria-labelledby="online-title">
				<span className="eyebrow">Online Table</span>
				<h1 id="online-title">A seat is waiting across the table.</h1>
				<p>Create a private Table or join one with a five-character code. Once both hunters are seated, the server deals the match.</p>
				<label htmlFor="online-player-name">Hunter name</label>
				<input
					id="online-player-name"
					value={playerName}
					maxLength={24}
					autoComplete="nickname"
					disabled={Boolean(busyMessage)}
					onChange={(event) => setPlayerName(event.target.value)}
				/>
				<div className="table-options">
					<div>
						<h2>Create Table</h2>
						<p>Take Player 1's seat and receive a private invitation code.</p>
						<button
							type="button"
							disabled={Boolean(busyMessage)}
							onClick={() => void establishSession(
								'Creating your Table…',
								(tableClient, uid, name) => tableClient.createTable(uid, name),
							)}
						>
							Create Table
						</button>
					</div>
					<form onSubmit={(event) => {
						event.preventDefault()
						void establishSession(
							'Joining the Table…',
							(tableClient, uid, name) => tableClient.joinTable(uid, name, joinCode),
							'Joining the Table timed out. Check your connection and try again.',
						)
					}}>
						<h2>Join Table</h2>
						<label htmlFor="table-code">Table code</label>
						<input
							id="table-code"
							value={joinCode}
							onChange={(event) => setJoinCode(normalizeTableCode(event.target.value).slice(0, 5))}
							placeholder="AB7KQ"
							autoComplete="off"
							disabled={Boolean(busyMessage)}
						/>
						<button type="submit" disabled={Boolean(busyMessage)}>Join Table</button>
					</form>
				</div>
				{busyMessage ? <p className="online-request-status" role="status">{busyMessage}</p> : null}
				{error ? <p className="field-error" role="alert">{error}</p> : null}
			</section>
		</main>
	)
}
