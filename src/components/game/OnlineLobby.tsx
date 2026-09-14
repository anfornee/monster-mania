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
import {
	OnlineTableError,
	type OnlineTableSession,
	type OnlineTableVisibility,
	type PublicOnlineTable,
} from '../../game/network/firebase/onlineTable'
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
	onLeave,
}: {
	session: OnlineTableSession
	uid: string
	client: OnlineTableClient
	onBack: () => void
	onLeave: () => Promise<void>
}) {
	const [snapshot, setSnapshot] = useState<OnlineGameSnapshot | null>(null)
	const [pending, setPending] = useState(false)
	const [rematchPending, setRematchPending] = useState(false)
	const [leavePending, setLeavePending] = useState(false)
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

	const leaveTable = async () => {
		if (leavePending) return
		setLeavePending(true)
		setError(null)
		try {
			await onLeave()
		} catch (leaveError) {
			setError(messageFor(leaveError))
			setLeavePending(false)
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
				<button type="button" onClick={() => void leaveTable()} disabled={leavePending}>
					{leavePending ? 'Leaving…' : 'Leave Table'}
				</button>
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
				onReturnToMenu={() => void leaveTable()}
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
	const [visibility, setVisibility] = useState<OnlineTableVisibility>('private')
	const [session, setSession] = useState<OnlineTableSession | null>(null)
	const [identity, setIdentity] = useState<MultiplayerIdentity | null>(null)
	const [client, setClient] = useState<OnlineTableClient | null>(null)
	const [publicTables, setPublicTables] = useState<PublicOnlineTable[]>([])
	const [publicTablesLoading, setPublicTablesLoading] = useState(!storedSession)
	const [publicTablesError, setPublicTablesError] = useState<string | null>(null)
	const [notice, setNotice] = useState<string | null>(null)
	const [restoringStoredSession, setRestoringStoredSession] = useState(Boolean(storedSession))
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
				if (active) {
					setBusyMessage(null)
					setRestoringStoredSession(false)
				}
			})
		return () => {
			active = false
		}
	}, [clientProvider, identityProvider, storedSession])

	useEffect(() => {
		if (session || restoringStoredSession || (identity && client)) return
		let active = true
		void Promise.all([identityProvider(), clientProvider()])
			.then(([nextIdentity, nextClient]) => {
				if (!active) return
				setIdentity(nextIdentity)
				setClient(nextClient)
			})
			.catch((listError) => {
				if (!active) return
				setPublicTablesLoading(false)
				setPublicTablesError(messageFor(listError))
			})
		return () => {
			active = false
		}
	}, [client, clientProvider, identity, identityProvider, restoringStoredSession, session])

	useEffect(() => {
		if (session || !identity || !client) return
		return client.watchPublicTables(
			(nextTables) => {
				setPublicTables(nextTables)
				setPublicTablesLoading(false)
				setPublicTablesError(null)
			},
			(listError) => {
				setPublicTablesLoading(false)
				setPublicTablesError(listError.message)
			},
		)
	}, [client, identity, listenerGeneration, session])

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
			(watchError) => {
				if (watchError.code === 'TABLE_NOT_FOUND' || watchError.code === 'SESSION_NOT_FOUND') {
					clearOnlineTableSession(window.localStorage)
					setSession(null)
					setPublicTablesLoading(true)
					setNotice('The other hunter left, so the Table was closed.')
					setError(null)
					return
				}
				setError(watchError.message)
			},
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
		setNotice(null)
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

	const leaveCurrentTable = async () => {
		if (!session || !client) return
		try {
			await withOnlineRequestTimeout(
				client.leaveTable(session.table.id),
				'Leaving the Table timed out. Check your connection and try again.',
			)
		} catch (leaveError) {
			if (!(leaveError instanceof OnlineTableError) || leaveError.code !== 'TABLE_NOT_FOUND') throw leaveError
		}
	clearOnlineTableSession(window.localStorage)
	setSession(null)
	setPublicTablesLoading(true)
		setNotice('You left the Table. It has been closed for both hunters.')
		setError(null)
	}

	if (session) {
		const table = session.table
		if (table.status !== 'waiting' && identity && client) {
			return (
				<OnlineMatch
					session={session}
					uid={identity.uid}
					client={client}
					onBack={onBack}
					onLeave={leaveCurrentTable}
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
							? table.visibility === 'public'
								? 'This public Table is listed for other hunters. You can also share its code directly.'
								: 'Share this code with Player 2. This private Table updates as soon as the seat is claimed.'
							: 'Both hunters are seated. The server is preparing the match.'}
					</p>
					{error ? <p className="field-error" role="alert">{error}</p> : null}
					<div className="setup-actions">
						<button type="button" className="secondary-button" onClick={onBack}>Return to tavern</button>
						<button
							type="button"
							className="forget-table-button"
							disabled={Boolean(busyMessage)}
							onClick={() => {
								setBusyMessage('Leaving the Table…')
								void leaveCurrentTable()
									.catch((leaveError) => setError(messageFor(leaveError)))
									.finally(() => setBusyMessage(null))
							}}
						>
							Leave this Table
						</button>
					</div>
					{busyMessage ? <p className="online-request-status" role="status">{busyMessage}</p> : null}
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
				<p>Create a private or public Table, join an invitation with its five-character code, or take a seat at an open Table below.</p>
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
						<p>Take Player 1's seat. Every Table gets a code; public Tables also appear in the open list.</p>
						<fieldset className="table-visibility">
							<legend>Who can join?</legend>
							<label>
								<input
									type="radio"
									name="table-visibility"
									value="private"
									checked={visibility === 'private'}
									disabled={Boolean(busyMessage)}
									onChange={() => setVisibility('private')}
								/>
								Private · code required
							</label>
							<label>
								<input
									type="radio"
									name="table-visibility"
									value="public"
									checked={visibility === 'public'}
									disabled={Boolean(busyMessage)}
									onChange={() => setVisibility('public')}
								/>
								Public · listed below
							</label>
						</fieldset>
						<button
							type="button"
							disabled={Boolean(busyMessage)}
							onClick={() => void establishSession(
								'Creating your Table…',
								(tableClient, uid, name) => tableClient.createTable(uid, name, visibility),
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
				{notice ? <p className="online-notice" role="status">{notice}</p> : null}
				<section className="open-tables" aria-labelledby="open-tables-title">
					<div className="open-tables-heading">
						<div>
							<span className="eyebrow">Public matchmaking</span>
							<h2 id="open-tables-title">Open Tables</h2>
						</div>
						<span aria-live="polite">{publicTables.length} available</span>
					</div>
					{publicTablesLoading ? <p role="status">Looking for open Tables…</p> : null}
					{publicTablesError ? <p className="field-error" role="alert">{publicTablesError}</p> : null}
					{!publicTablesLoading && !publicTablesError && publicTables.length === 0 ? (
						<p>No public Tables are open right now. You can create the first one.</p>
					) : null}
					{publicTables.length > 0 ? (
						<ul>
							{publicTables.map((table) => (
								<li key={table.id}>
									<span><strong>{table.hostName}</strong><small>Waiting for an opponent</small></span>
									<button
										type="button"
										disabled={Boolean(busyMessage)}
										onClick={() => void establishSession(
											'Joining the open Table…',
											(tableClient, uid, name) => tableClient.joinTable(uid, name, table.joinCode),
											'Joining the Table timed out. Check your connection and try again.',
										)}
									>
										Join Table
									</button>
								</li>
							))}
						</ul>
					) : null}
				</section>
			</section>
		</main>
	)
}
