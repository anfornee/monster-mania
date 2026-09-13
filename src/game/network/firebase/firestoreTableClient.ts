import {
	collection,
	doc,
	getDoc,
	onSnapshot,
	runTransaction,
	serverTimestamp,
	Timestamp,
	type DocumentData,
	type DocumentSnapshot,
	type Firestore,
	type Unsubscribe,
} from 'firebase/firestore'
import { createTableCode, isValidTableCode, normalizeTableCode } from '../tableCode'
import { getMultiplayerFirestore } from './firebaseServices'
import {
	OnlineTableError,
	type OnlineTable,
	type OnlineTableRole,
	type OnlineTableSession,
} from './onlineTable'

interface FirestoreTableClientOptions {
	createCode?: () => string
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

function tableFromSnapshot(snapshot: DocumentSnapshot<DocumentData>): OnlineTable {
	if (!snapshot.exists()) throw new OnlineTableError('TABLE_NOT_FOUND', 'This Table no longer exists.')
	const data = snapshot.data()
	if (
		data.schemaVersion !== 1
		|| typeof data.joinCode !== 'string'
		|| !isValidTableCode(data.joinCode)
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
		status: data.status,
		hostUid: data.hostUid,
		hostName: data.hostName,
		guestUid: data.guestUid,
		guestName: data.guestName,
		createdAtMs: timestampMillis(data.createdAt),
		updatedAtMs: timestampMillis(data.updatedAt),
	}
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

export interface OnlineTableClient {
	createTable: (uid: string, playerName: string) => Promise<OnlineTableSession>
	joinTable: (uid: string, playerName: string, joinCode: string) => Promise<OnlineTableSession>
	resumeTable: (uid: string, tableId: string) => Promise<OnlineTableSession>
	watchTable: (
		tableId: string,
		uid: string,
		onTable: (session: OnlineTableSession) => void,
		onError: (error: OnlineTableError) => void,
	) => Unsubscribe
}

export class FirestoreTableClient implements OnlineTableClient {
	private readonly firestore: Firestore
	private readonly createCode: () => string

	constructor(firestore: Firestore, options: FirestoreTableClientOptions = {}) {
		this.firestore = firestore
		this.createCode = options.createCode ?? createTableCode
	}

	async createTable(uid: string, playerName: string): Promise<OnlineTableSession> {
		const hostName = cleanPlayerName(playerName)
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
			() => onError(new OnlineTableError('FIREBASE_UNAVAILABLE', 'Live Table updates were interrupted.')),
		)
	}
}

let defaultClientPromise: Promise<FirestoreTableClient> | null = null

export function getOnlineTableClient(): Promise<FirestoreTableClient> {
	defaultClientPromise ??= getMultiplayerFirestore().then((firestore) => new FirestoreTableClient(firestore))
	return defaultClientPromise
}
