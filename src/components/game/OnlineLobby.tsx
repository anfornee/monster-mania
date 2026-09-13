import { useEffect, useState } from 'react'
import {
	ensureMultiplayerIdentity,
	type MultiplayerIdentity,
} from '../../game/network/firebase/multiplayerIdentity'
import {
	getOnlineTableClient,
	type OnlineTableClient,
} from '../../game/network/firebase/firestoreTableClient'
import { OnlineTableError, type OnlineTableSession } from '../../game/network/firebase/onlineTable'
import {
	clearOnlineTableSession,
	loadOnlineTableSession,
	saveOnlineTableSession,
} from '../../game/network/firebase/tableSessionStorage'
import { normalizeTableCode } from '../../game/network/tableCode'
import { normalizePlayerName, savePlayerName, validatePlayerName } from '../../game/presentation/playerProfile'

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

	useEffect(() => {
		if (!storedSession) return
		let active = true
		void Promise.all([identityProvider(), clientProvider()])
			.then(async ([restoredIdentity, restoredClient]) => {
				const restored = await restoredClient.resumeTable(restoredIdentity.uid, storedSession.tableId)
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
	}, [client, identity, watchedTableId])

	const establishSession = async (
		busy: string,
		operation: (tableClient: OnlineTableClient, uid: string, name: string) => Promise<OnlineTableSession>,
	) => {
		const nameError = validatePlayerName(playerName)
		if (nameError) {
			setError(nameError)
			return
		}
		setBusyMessage(busy)
		setError(null)
		try {
			const [nextIdentity, nextClient] = await Promise.all([identityProvider(), clientProvider()])
			const normalizedName = normalizePlayerName(playerName)
			const nextSession = await operation(nextClient, nextIdentity.uid, normalizedName)
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
							: 'Table membership is synchronized. Online gameplay synchronization is the next milestone.'}
					</p>
					{error ? <p className="field-error" role="alert">{error}</p> : null}
					<div className="setup-actions">
						<button type="button" className="secondary-button" onClick={onBack}>Return to tavern</button>
						<button type="button" className="forget-table-button" onClick={() => {
							clearOnlineTableSession(window.localStorage)
							setSession(null)
							setIdentity(null)
							setClient(null)
						}}>Forget this Table</button>
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
				<p>Create a private Table or join one with a five-character code. The lobby is live; synchronized gameplay follows in the next milestone.</p>
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
