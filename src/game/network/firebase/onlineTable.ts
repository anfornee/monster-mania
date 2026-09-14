import type { TableStatus } from '../protocol'
import type { PublicGameState } from '../clientState'
import type { OnlineGameEvent, OnlineRematchRequests } from '../onlineGame'

export type OnlineTableStatus = TableStatus
export type OnlineTableRole = 'host' | 'guest'
export type OnlineTableVisibility = 'private' | 'public'

export interface PublicOnlineTable {
	id: string
	joinCode: string
	hostName: string
	createdAtMs: number | null
}

export interface OnlineTable {
	id: string
	joinCode: string
	visibility: OnlineTableVisibility
	status: OnlineTableStatus
	hostUid: string
	hostName: string
	guestUid: string | null
	guestName: string | null
	createdAtMs: number | null
	updatedAtMs: number | null
	revision: number | null
	publicGameState: PublicGameState | null
	lastGameEvent: OnlineGameEvent | null
	rematchRequests: OnlineRematchRequests
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
	| 'REMATCH_NOT_AVAILABLE'
	| 'INVALID_PLAYER_NAME'
	| 'INVALID_TABLE_DATA'
	| 'SESSION_NOT_FOUND'
	| 'GAME_NOT_READY'
	| 'NOT_YOUR_TURN'
	| 'STALE_REVISION'
	| 'ILLEGAL_ACTION'
	| 'FIREBASE_UNAVAILABLE'

export class OnlineTableError extends Error {
	readonly code: OnlineTableErrorCode

	constructor(code: OnlineTableErrorCode, message: string) {
		super(message)
		this.name = 'OnlineTableError'
		this.code = code
	}
}
