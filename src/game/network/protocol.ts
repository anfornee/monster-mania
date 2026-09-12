import type { PlayerId } from '../definitions/types'
import type { GameAction } from '../engine/types'
import type { ClientGameState } from './clientState'

export type TableCode = string
export type SeatToken = string

export interface TableCredentials {
	tableCode: TableCode
	playerId: PlayerId
	seatToken: SeatToken
}

export type ClientTableMessage =
	| { type: 'CREATE_TABLE'; playerName: string }
	| { type: 'JOIN_TABLE'; tableCode: TableCode; playerName: string }
	| { type: 'RESUME_TABLE'; credentials: TableCredentials }
	| {
			type: 'SUBMIT_GAME_ACTION'
			credentials: TableCredentials
			action: GameAction
	  }

export type TableErrorCode =
	| 'INVALID_TABLE_CODE'
	| 'TABLE_NOT_FOUND'
	| 'TABLE_FULL'
	| 'INVALID_PLAYER_NAME'
	| 'INVALID_CREDENTIALS'
	| 'GAME_NOT_STARTED'
	| 'PLAYER_MISMATCH'
	| 'NOT_YOUR_TURN'
	| 'ILLEGAL_ACTION'
	| 'INVALID_GAME_STATE'

export interface TableSession {
	credentials: TableCredentials
	status: 'waiting' | 'active'
	state: ClientGameState | null
}

export type ServerTableMessage =
	| { type: 'TABLE_SESSION'; session: TableSession }
	| { type: 'TABLE_STATE'; state: ClientGameState }
	| { type: 'TABLE_ERROR'; code: TableErrorCode; message: string }

export type TableResult<T> =
	| { ok: true; value: T }
	| { ok: false; code: TableErrorCode; error: string }
