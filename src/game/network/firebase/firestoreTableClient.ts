import {
	collection,
	doc,
	getDoc,
	limit,
	onSnapshot,
	query,
	runTransaction,
	serverTimestamp,
	Timestamp,
	where,
	type DocumentData,
	type DocumentSnapshot,
	type Firestore,
	type Unsubscribe,
} from 'firebase/firestore'
import {
	httpsCallable,
	type Functions,
} from 'firebase/functions'
import type { GameAction } from '../../engine/types'
import type { PublicGameState } from '../clientState'
import type {
	OnlineGameAction,
	OnlineGameEvent,
	OnlineGameSnapshot,
	OnlinePrivateGameState,
	OnlineRematchRequests,
} from '../onlineGame'
import { combineOnlineGameView, materializeClientGameState } from '../onlineGameView'
import { createTableCode, isValidTableCode, normalizeTableCode } from '../tableCode'
import { getMultiplayerFirestore, getMultiplayerFunctions } from './firebaseServices'
import {
	OnlineTableError,
	type OnlineTable,
	type OnlineTableRole,
	type OnlineTableSession,
	type OnlineTableVisibility,
	type PublicOnlineTable,
} from './onlineTable'

interface FirestoreTableClientOptions {
	createCode?: () => string
	functions?: Functions
}

interface TableCodeRecord {
	tableId: string
	joinCode: string
	status: OnlineTable['status']
	hostUid: string
	guestUid: string | null
}

const MAX_CODE_ATTEMPTS = 12
const PLAYER_NAME_MAX_LENGTH = 24
const CODE_COLLISION = Symbol('code-collision')

function cleanPlayerName(value: string): string {
	const clean = value.trim()
	if (clean.length < 2 || clean.length > PLAYER_NAME_MAX_LENGTH) {
		throw new OnlineTableError('INVALID_PLAYER_NAME', 'Player name must be between 2 and 24 characters.')
	}
	return clean
}

function timestampMillis(value: unknown): number | null {
	return value instanceof Timestamp ? value.toMillis() : null
}

function readRematchRequests(value: unknown): OnlineRematchRequests {
	if (
		!value
		|| typeof value !== 'object'
		|| typeof (value as { host?: unknown }).host !== 'boolean'
		|| typeof (value as { guest?: unknown }).guest !== 'boolean'
	) return { host: false, guest: false }
	return value as OnlineRematchRequests
}

function tableFromSnapshot(snapshot: DocumentSnapshot<DocumentData>): OnlineTable {
	if (!snapshot.exists()) throw new OnlineTableError('TABLE_NOT_FOUND', 'This Table no longer exists.')
	const data = snapshot.data()
	if (
		data.schemaVersion !== 1
		|| typeof data.joinCode !== 'string'
		|| !isValidTableCode(data.joinCode)
		|| (data.visibility !== undefined && !['private', 'public'].includes(data.visibility))
		|| !['waiting', 'playing', 'finished'].includes(data.status)
		|| typeof data.hostUid !== 'string'
		|| typeof data.hostName !== 'string'
		|| (data.guestUid !== null && typeof data.guestUid !== 'string')
		|| (data.guestName !== null && typeof data.guestName !== 'string')
	) {
		throw new OnlineTableError('INVALID_TABLE_DATA', 'The Table record is not compatible with this client.')
	}
	return {
		id: snapshot.id,
		joinCode: data.joinCode,
		visibility: data.visibility === 'public' ? 'public' : 'private',
		status: data.status,
		hostUid: data.hostUid,
		hostName: data.hostName,
		guestUid: data.guestUid,
		guestName: data.guestName,
		createdAtMs: timestampMillis(data.createdAt),
		updatedAtMs: timestampMillis(data.updatedAt),
		revision: Number.isSafeInteger(data.revision) ? data.revision : null,
		publicGameState: readPublicGameState(data.publicGameState),
		lastGameEvent: readOnlineGameEvent(data.lastGameEvent),
		rematchRequests: readRematchRequests(data.rematchRequests),
	}
}

function readPublicGameState(value: unknown): PublicGameState | null {
	if (!value || typeof value !== 'object') return null
	const state = value as Partial<PublicGameState>
	if (
		state.schemaVersion !== 1
		|| typeof state.rulesetId !== 'string'
		|| !Array.isArray(state.players)
		|| !state.turn
		|| !Array.isArray(state.faceUpMonsterIds)
		|| !Array.isArray(state.events)
	) return null
	return value as PublicGameState
}

function readOnlineGameEvent(value: unknown): OnlineGameEvent | null {
	if (value === null || value === undefined) return null
	if (!value || typeof value !== 'object') return null
	const event = value as Partial<OnlineGameEvent>
	return typeof event.id === 'string'
		&& Number.isSafeInteger(event.revision)
		&& typeof event.actorPlayerId === 'string'
		&& typeof event.actionType === 'string'
		&& Array.isArray(event.revealedCardDefinitionIds)
		? value as OnlineGameEvent
		: null
}

function readPrivateGameState(value: DocumentData | undefined): OnlinePrivateGameState | null {
	if (
		!value
		|| value.schemaVersion !== 1
		|| !Number.isSafeInteger(value.revision)
		|| typeof value.playerId !== 'string'
		|| !Array.isArray(value.hand)
		|| !Array.isArray(value.selectedCardInstanceIds)
	) return null
	return value as OnlinePrivateGameState
}

function roleFor(table: OnlineTable, uid: string): OnlineTableRole {
	if (table.hostUid === uid) return 'host'
	if (table.guestUid === uid) return 'guest'
	throw new OnlineTableError('SESSION_NOT_FOUND', 'This browser does not hold a seat at that Table.')
}

function readCodeRecord(data: DocumentData | undefined): TableCodeRecord | null {
	if (
		!data
		|| typeof data.tableId !== 'string'
		|| typeof data.joinCode !== 'string'
		|| !['waiting', 'playing', 'finished'].includes(data.status)
		|| typeof data.hostUid !== 'string'
		|| (data.guestUid !== null && typeof data.guestUid !== 'string')
	) return null
	return data as TableCodeRecord
}

function normalizeFirebaseError(error: unknown): never {
	if (error instanceof OnlineTableError) throw error
	throw new OnlineTableError(
		'FIREBASE_UNAVAILABLE',
		'The Online Table service is unavailable. Check your connection and try again.',
	)
}

function tableListenerError(error: unknown, fallback: string): OnlineTableError {
	const code = error && typeof error === 'object' && 'code' in error
		? (error as { code?: unknown }).code
		: null
	return code === 'permission-denied'
		? new OnlineTableError('TABLE_NOT_FOUND', 'This Table was closed by a player.')
		: new OnlineTableError('FIREBASE_UNAVAILABLE', fallback)
}

export interface OnlineTableClient {
	createTable: (uid: string, playerName: string, visibility?: OnlineTableVisibility) => Promise<OnlineTableSession>
	joinTable: (uid: string, playerName: string, joinCode: string) => Promise<OnlineTableSession>
	resumeTable: (uid: string, tableId: string) => Promise<OnlineTableSession>
	watchPublicTables: (
		onTables: (tables: PublicOnlineTable[]) => void,
		onError: (error: OnlineTableError) => void,
	) => Unsubscribe
	watchTable: (
		tableId: string,
		uid: string,
		onTable: (session: OnlineTableSession) => void,
		onError: (error: OnlineTableError) => void,
	) => Unsubscribe
	initializeGame: (tableId: string) => Promise<number>
	requestRematch: (tableId: string) => Promise<number>
	leaveTable: (tableId: string) => Promise<void>
	submitAction: (tableId: string, expectedRevision: number, action: GameAction) => Promise<number>
	watchGame: (
		tableId: string,
		uid: string,
		onGame: (snapshot: OnlineGameSnapshot) => void,
		onError: (error: OnlineTableError) => void,
	) => Unsubscribe
}

export class FirestoreTableClient implements OnlineTableClient {
	private readonly firestore: Firestore
	private readonly createCode: () => string
	private readonly functions: Functions | null

	constructor(firestore: Firestore, options: FirestoreTableClientOptions = {}) {
		this.firestore = firestore
		this.createCode = options.createCode ?? createTableCode
		this.functions = options.functions ?? null
	}

	async createTable(
		uid: string,
		playerName: string,
		visibility: OnlineTableVisibility = 'private',
	): Promise<OnlineTableSession> {
		const hostName = cleanPlayerName(playerName)
		if (visibility !== 'private' && visibility !== 'public') {
			throw new OnlineTableError('INVALID_TABLE_DATA', 'Choose a valid Table visibility.')
		}
		const tableRef = doc(collection(this.firestore, 'tables'))
		for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
			const joinCode = normalizeTableCode(this.createCode())
			if (!isValidTableCode(joinCode)) {
				throw new OnlineTableError('INVALID_TABLE_CODE', 'The Table code generator returned an invalid code.')
			}
			const codeRef = doc(this.firestore, 'tableCodes', joinCode)
			try {
				await runTransaction(this.firestore, async (transaction) => {
					if ((await transaction.get(codeRef)).exists()) throw CODE_COLLISION
					transaction.set(tableRef, {
						schemaVersion: 1,
						joinCode,
						visibility,
						status: 'waiting',
						hostUid: uid,
						hostName,
						guestUid: null,
						guestName: null,
						createdAt: serverTimestamp(),
						updatedAt: serverTimestamp(),
					})
					transaction.set(codeRef, {
						schemaVersion: 1,
						joinCode,
						tableId: tableRef.id,
						status: 'waiting',
						hostUid: uid,
						guestUid: null,
						createdAt: serverTimestamp(),
						updatedAt: serverTimestamp(),
					})
				})
				const table = tableFromSnapshot(await getDoc(tableRef))
				return { table, role: 'host' }
			} catch (error) {
				if (error === CODE_COLLISION) continue
				normalizeFirebaseError(error)
			}
		}
		throw new OnlineTableError('FIREBASE_UNAVAILABLE', 'Unable to allocate a unique Table code. Try again.')
	}

	async joinTable(uid: string, playerName: string, value: string): Promise<OnlineTableSession> {
		const guestName = cleanPlayerName(playerName)
		const joinCode = normalizeTableCode(value)
		if (!isValidTableCode(joinCode)) {
			throw new OnlineTableError('INVALID_TABLE_CODE', 'Enter a valid five-character Table code.')
		}
		const codeRef = doc(this.firestore, 'tableCodes', joinCode)
		try {
			const result = await runTransaction(this.firestore, async (transaction) => {
				const codeSnapshot = await transaction.get(codeRef)
				const code = readCodeRecord(codeSnapshot.data())
				if (!code) throw new OnlineTableError('TABLE_NOT_FOUND', 'No Table uses that code.')
				if (code.hostUid === uid || code.guestUid === uid) return { tableId: code.tableId, joined: false }
				if (code.status === 'finished') throw new OnlineTableError('TABLE_FINISHED', 'That Table has already finished.')
				if (code.status !== 'waiting' || code.guestUid) {
					throw new OnlineTableError('TABLE_FULL', 'That Table already has two players.')
				}
				const tableRef = doc(this.firestore, 'tables', code.tableId)
				const tableSnapshot = await transaction.get(tableRef)
				if (!tableSnapshot.exists()) throw new OnlineTableError('TABLE_NOT_FOUND', 'That Table no longer exists.')
				transaction.update(tableRef, {
					status: 'playing',
					guestUid: uid,
					guestName,
					updatedAt: serverTimestamp(),
				})
				transaction.update(codeRef, {
					status: 'playing',
					guestUid: uid,
					updatedAt: serverTimestamp(),
				})
				return { tableId: code.tableId, joined: true }
			})
			const table = tableFromSnapshot(await getDoc(doc(this.firestore, 'tables', result.tableId)))
			return { table, role: roleFor(table, uid) }
		} catch (error) {
			if (!(error instanceof OnlineTableError)) {
				try {
					const current = readCodeRecord((await getDoc(codeRef)).data())
					if (current?.status === 'finished') {
						throw new OnlineTableError('TABLE_FINISHED', 'That Table has already finished.')
					}
					if (current && (current.status !== 'waiting' || current.guestUid)) {
						throw new OnlineTableError('TABLE_FULL', 'That Table already has two players.')
					}
				} catch (lookupError) {
					if (lookupError instanceof OnlineTableError) throw lookupError
				}
			}
			normalizeFirebaseError(error)
		}
	}

	async resumeTable(uid: string, tableId: string): Promise<OnlineTableSession> {
		try {
			const table = tableFromSnapshot(await getDoc(doc(this.firestore, 'tables', tableId)))
			return { table, role: roleFor(table, uid) }
		} catch (error) {
			if (error && typeof error === 'object' && 'code' in error && error.code === 'permission-denied') {
				throw new OnlineTableError('TABLE_NOT_FOUND', 'This Table was closed by a player.')
			}
			normalizeFirebaseError(error)
		}
	}

	watchTable(
		tableId: string,
		uid: string,
		onTable: (session: OnlineTableSession) => void,
		onError: (error: OnlineTableError) => void,
	): Unsubscribe {
		return onSnapshot(
			doc(this.firestore, 'tables', tableId),
			(snapshot) => {
				try {
					const table = tableFromSnapshot(snapshot)
					onTable({ table, role: roleFor(table, uid) })
				} catch (error) {
					onError(error instanceof OnlineTableError ? error : new OnlineTableError('INVALID_TABLE_DATA', 'The Table update was invalid.'))
				}
			},
			(watchError) => onError(tableListenerError(watchError, 'Live Table updates were interrupted.')),
		)
	}

	watchPublicTables(
		onTables: (tables: PublicOnlineTable[]) => void,
		onError: (error: OnlineTableError) => void,
	): Unsubscribe {
		const openTables = query(
			collection(this.firestore, 'tables'),
			where('visibility', '==', 'public'),
			where('status', '==', 'waiting'),
			where('guestUid', '==', null),
			limit(20),
		)
		return onSnapshot(
			openTables,
			(snapshot) => onTables(snapshot.docs
				.map((document) => tableFromSnapshot(document))
				.map((table) => ({
					id: table.id,
					joinCode: table.joinCode,
					hostName: table.hostName,
					createdAtMs: table.createdAtMs,
				}))
				.sort((left, right) => (left.createdAtMs ?? 0) - (right.createdAtMs ?? 0))),
			() => onError(new OnlineTableError('FIREBASE_UNAVAILABLE', 'Open Table updates were interrupted.')),
		)
	}

	async initializeGame(tableId: string): Promise<number> {
		if (!this.functions) throw new OnlineTableError('FIREBASE_UNAVAILABLE', 'Firebase Functions are unavailable.')
		try {
			const callable = httpsCallable<{ tableId: string }, { revision: number }>(
				this.functions,
				'initializeOnlineGame',
			)
			return (await callable({ tableId })).data.revision
		} catch (error) {
			this.normalizeGameError(error)
		}
	}

	async requestRematch(tableId: string): Promise<number> {
		if (!this.functions) throw new OnlineTableError('FIREBASE_UNAVAILABLE', 'Firebase Functions are unavailable.')
		try {
			const callable = httpsCallable<{ tableId: string }, { revision: number }>(
				this.functions,
				'requestOnlineRematch',
			)
			return (await callable({ tableId })).data.revision
		} catch (error) {
			this.normalizeGameError(error)
		}
	}

	async leaveTable(tableId: string): Promise<void> {
		if (!this.functions) throw new OnlineTableError('FIREBASE_UNAVAILABLE', 'Firebase Functions are unavailable.')
		try {
			const callable = httpsCallable<{ tableId: string }, { removed: boolean }>(
				this.functions,
				'leaveOnlineTable',
			)
			await callable({ tableId })
		} catch (error) {
			this.normalizeGameError(error)
		}
	}

	async submitAction(tableId: string, expectedRevision: number, action: GameAction): Promise<number> {
		if (!this.functions) throw new OnlineTableError('FIREBASE_UNAVAILABLE', 'Firebase Functions are unavailable.')
		const wireAction = Object.fromEntries(
			Object.entries(action).filter(([key]) => key !== 'playerId'),
		) as OnlineGameAction
		try {
			const callable = httpsCallable<{
				tableId: string
				commandId: string
				expectedRevision: number
				action: OnlineGameAction
			}, { revision: number }>(this.functions, 'submitOnlineGameCommand')
			return (await callable({
				tableId,
				commandId: crypto.randomUUID(),
				expectedRevision,
				action: wireAction as OnlineGameAction,
			})).data.revision
		} catch (error) {
			this.normalizeGameError(error)
		}
	}

	watchGame(
		tableId: string,
		uid: string,
		onGame: (snapshot: OnlineGameSnapshot) => void,
		onError: (error: OnlineTableError) => void,
	): Unsubscribe {
		let table: OnlineTable | null = null
		let privateState: OnlinePrivateGameState | null = null
		const publish = () => {
			if (
				!table?.publicGameState
				|| table.revision === null
				|| !privateState
				|| privateState.revision !== table.revision
			) return
			const view = combineOnlineGameView(table.publicGameState, privateState)
			onGame({
				revision: table.revision,
				state: materializeClientGameState(view),
				event: table.lastGameEvent,
			})
		}
		const unsubscribeTable = onSnapshot(
			doc(this.firestore, 'tables', tableId),
			(snapshot) => {
				try {
					table = tableFromSnapshot(snapshot)
					roleFor(table, uid)
					publish()
				} catch (error) {
					onError(error instanceof OnlineTableError ? error : new OnlineTableError('INVALID_TABLE_DATA', 'The game update was invalid.'))
				}
			},
			(watchError) => onError(tableListenerError(watchError, 'Shared game updates were interrupted.')),
		)
		const unsubscribePrivate = onSnapshot(
			doc(this.firestore, 'tables', tableId, 'private', uid),
			(snapshot) => {
				privateState = readPrivateGameState(snapshot.data())
				publish()
			},
			(watchError) => onError(tableListenerError(watchError, 'Private game updates were interrupted.')),
		)
		return () => {
			unsubscribeTable()
			unsubscribePrivate()
		}
	}

	private normalizeGameError(error: unknown): never {
		const details = error && typeof error === 'object' && 'details' in error
			? (error as { details?: { reason?: string } }).details
			: undefined
		const reason = details?.reason
		if (reason === 'STALE_REVISION') throw new OnlineTableError('STALE_REVISION', 'The match advanced; your view is refreshing.')
		if (reason === 'NOT_YOUR_TURN') throw new OnlineTableError('NOT_YOUR_TURN', 'It is not your turn.')
		if (reason === 'ILLEGAL_ACTION') throw new OnlineTableError('ILLEGAL_ACTION', 'That move is not legal.')
		if (reason === 'GAME_NOT_STARTED') throw new OnlineTableError('GAME_NOT_READY', 'The match is still initializing.')
		if (reason === 'GAME_FINISHED') throw new OnlineTableError('TABLE_FINISHED', 'This match has finished.')
		if (reason === 'REMATCH_NOT_AVAILABLE') throw new OnlineTableError('REMATCH_NOT_AVAILABLE', 'A rematch is only available after the match finishes.')
		if (reason === 'TABLE_NOT_FOUND') throw new OnlineTableError('TABLE_NOT_FOUND', 'This Table no longer exists.')
		if (reason === 'NOT_A_PARTICIPANT') throw new OnlineTableError('SESSION_NOT_FOUND', 'This browser does not hold a seat at that Table.')
		normalizeFirebaseError(error)
	}
}

let defaultClientPromise: Promise<FirestoreTableClient> | null = null

export function getOnlineTableClient(): Promise<FirestoreTableClient> {
	defaultClientPromise ??= Promise.all([getMultiplayerFirestore(), getMultiplayerFunctions()])
		.then(([firestore, functions]) => new FirestoreTableClient(firestore, { functions }))
	return defaultClientPromise
}
