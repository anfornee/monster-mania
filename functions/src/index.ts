import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { setGlobalOptions } from 'firebase-functions/v2'
import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import {
	OnlineAuthorityError,
	parseOnlineGameCommand,
} from '../../src/game/network/authoritativeOnlineGame'
import { initializeMatchForTable, submitCommandForTable } from './onlineGameRepository'

if (getApps().length === 0) initializeApp()
const database = getFirestore()

setGlobalOptions({
	region: 'us-central1',
	memory: '256MiB',
	minInstances: 0,
	maxInstances: 5,
})

function callableError(error: unknown): never {
	if (!(error instanceof OnlineAuthorityError)) {
		console.error(error)
		throw new HttpsError('internal', 'The Online Table service could not complete the request.')
	}
	const mappings = {
		UNAUTHENTICATED: 'unauthenticated',
		INVALID_ARGUMENT: 'invalid-argument',
		TABLE_NOT_FOUND: 'not-found',
		NOT_A_PARTICIPANT: 'permission-denied',
		GAME_NOT_STARTED: 'failed-precondition',
		GAME_FINISHED: 'failed-precondition',
		NOT_YOUR_TURN: 'failed-precondition',
		STALE_REVISION: 'aborted',
		ILLEGAL_ACTION: 'failed-precondition',
		INVALID_GAME_STATE: 'internal',
	} as const
	throw new HttpsError(mappings[error.code], error.message, { reason: error.code })
}

function authenticatedUid(auth: { uid: string } | undefined): string {
	if (!auth) throw new OnlineAuthorityError('UNAUTHENTICATED', 'Authentication is required.')
	return auth.uid
}

export const initializeOnlineGame = onCall(async (request) => {
	try {
		const uid = authenticatedUid(request.auth)
		const data = request.data as { tableId?: unknown } | null
		if (!data || typeof data.tableId !== 'string' || !data.tableId || data.tableId.length > 128) {
			throw new OnlineAuthorityError('INVALID_ARGUMENT', 'A valid Table ID is required.')
		}
		const table = await database.doc(`tables/${data.tableId}`).get()
		const tableData = table.data()
		if (!tableData || (tableData.hostUid !== uid && tableData.guestUid !== uid)) {
			throw new OnlineAuthorityError('NOT_A_PARTICIPANT', 'This identity does not hold a seat at the Table.')
		}
		return await initializeMatchForTable(database, data.tableId)
	} catch (error) {
		callableError(error)
	}
})

export const submitOnlineGameCommand = onCall(async (request) => {
	try {
		const uid = authenticatedUid(request.auth)
		const command = parseOnlineGameCommand(request.data)
		return await submitCommandForTable(database, uid, command)
	} catch (error) {
		callableError(error)
	}
})

export const initializeGameWhenTableIsSeated = onDocumentUpdated(
	'tables/{tableId}',
	async (event) => {
		const before = event.data?.before.data()
		const after = event.data?.after.data()
		if (before?.status === 'waiting' && after?.status === 'playing') {
			await initializeMatchForTable(database, event.params.tableId)
		}
	},
)
