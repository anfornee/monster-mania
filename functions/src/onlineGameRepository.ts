import { randomBytes } from 'node:crypto'
import type { Firestore, Transaction } from 'firebase-admin/firestore'
import { FieldValue } from 'firebase-admin/firestore'
import {
	applyOnlineGameCommand,
	initializeOnlineMatch,
	OnlineAuthorityError,
	type OnlineMatchWriteModel,
	type SeatedOnlineTable,
} from '../../src/game/network/authoritativeOnlineGame'
import type { AuthoritativeOnlineMatch, OnlineGameCommand } from '../../src/game/network/onlineGame'

function seed(): number {
	return randomBytes(4).readUInt32BE(0)
}

function tableFromData(tableId: string, data: FirebaseFirestore.DocumentData | undefined): SeatedOnlineTable {
	if (
		!data
		|| !['waiting', 'playing', 'finished'].includes(data.status)
		|| typeof data.hostUid !== 'string'
		|| typeof data.hostName !== 'string'
		|| (data.guestUid !== null && typeof data.guestUid !== 'string')
		|| (data.guestName !== null && typeof data.guestName !== 'string')
	) throw new OnlineAuthorityError('TABLE_NOT_FOUND', 'The Table does not exist or is invalid.')
	return {
		id: tableId,
		status: data.status,
		hostUid: data.hostUid,
		hostName: data.hostName,
		guestUid: data.guestUid,
		guestName: data.guestName,
	}
}

function authorityFromData(data: FirebaseFirestore.DocumentData | undefined): AuthoritativeOnlineMatch | null {
	if (!data) return null
	if (
		data.schemaVersion !== 1
		|| !Number.isSafeInteger(data.revision)
		|| !data.gameState
		|| !Array.isArray(data.processedCommands)
	) throw new OnlineAuthorityError('INVALID_GAME_STATE', 'The stored authoritative match is invalid.')
	return data as AuthoritativeOnlineMatch
}

function writeMatch(
	transaction: Transaction,
	database: Firestore,
	tableId: string,
	model: OnlineMatchWriteModel,
): void {
	const tableRef = database.doc(`tables/${tableId}`)
	transaction.set(database.doc(`tables/${tableId}/authority/state`), model.authority)
	transaction.update(tableRef, {
		...model.public,
		status: model.authority.gameState.phase === 'game-over' ? 'finished' : 'playing',
		updatedAt: FieldValue.serverTimestamp(),
	})
	for (const [uid, privateState] of Object.entries(model.privateByUid)) {
		transaction.set(database.doc(`tables/${tableId}/private/${uid}`), privateState)
	}
}

export async function initializeMatchForTable(
	database: Firestore,
	tableId: string,
	createSeed: () => number = seed,
): Promise<{ initialized: boolean; revision: number }> {
	return database.runTransaction(async (transaction) => {
		const tableRef = database.doc(`tables/${tableId}`)
		const authorityRef = database.doc(`tables/${tableId}/authority/state`)
		const [tableSnapshot, authoritySnapshot] = await transaction.getAll(tableRef, authorityRef)
		const table = tableFromData(tableId, tableSnapshot.data())
		const existing = authorityFromData(authoritySnapshot.data())
		if (existing) return { initialized: false, revision: existing.revision }
		const model = initializeOnlineMatch(table, createSeed())
		writeMatch(transaction, database, tableId, model)
		return { initialized: true, revision: model.authority.revision }
	})
}

export async function submitCommandForTable(
	database: Firestore,
	uid: string,
	command: OnlineGameCommand,
): Promise<{ duplicate: boolean; revision: number }> {
	return database.runTransaction(async (transaction) => {
		const tableRef = database.doc(`tables/${command.tableId}`)
		const authorityRef = database.doc(`tables/${command.tableId}/authority/state`)
		const [tableSnapshot, authoritySnapshot] = await transaction.getAll(tableRef, authorityRef)
		const table = tableFromData(command.tableId, tableSnapshot.data())
		const authority = authorityFromData(authoritySnapshot.data())
		const model = applyOnlineGameCommand(table, authority, uid, command)
		if (!model.duplicate) writeMatch(transaction, database, command.tableId, model)
		return { duplicate: model.duplicate, revision: model.authority.revision }
	})
}

