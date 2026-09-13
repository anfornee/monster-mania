import type { TableStatus } from '../protocol'

export type OnlineTableStatus = TableStatus
export type OnlineTableRole = 'host' | 'guest'

export interface OnlineTable {
	id: string
	joinCode: string
	status: OnlineTableStatus
	hostUid: string
	hostName: string
	guestUid: string | null
	guestName: string | null
	createdAtMs: number | null
	updatedAtMs: number | null
}

export interface OnlineTableSession {
	table: OnlineTable
	role: OnlineTableRole
}

export type OnlineTableErrorCode =
	| 'INVALID_TABLE_CODE'
	| 'TABLE_NOT_FOUND'
	| 'TABLE_FULL'
	| 'TABLE_FINISHED'
	| 'INVALID_PLAYER_NAME'
	| 'INVALID_TABLE_DATA'
	| 'SESSION_NOT_FOUND'
	| 'FIREBASE_UNAVAILABLE'

export class OnlineTableError extends Error {
	readonly code: OnlineTableErrorCode

	constructor(code: OnlineTableErrorCode, message: string) {
		super(message)
		this.name = 'OnlineTableError'
		this.code = code
	}
}
