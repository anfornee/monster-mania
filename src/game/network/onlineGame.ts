import type {
	CardInstanceId,
	PlayerCardDefinitionId,
	PlayerCardInstance,
	PlayerId,
} from '../definitions/types'
import type { GameAction, GameState } from '../engine/types'
import type { PublicGameState } from './clientState'

type WithoutPlayerId<T> = T extends { playerId: PlayerId } ? Omit<T, 'playerId'> : never

export type OnlineGameAction = WithoutPlayerId<GameAction>

export interface OnlineGameCommand {
	tableId: string
	commandId: string
	expectedRevision: number
	action: OnlineGameAction
}

export interface ProcessedOnlineCommand {
	commandId: string
	revision: number
	actorUid: string
}

export interface OnlineGameEvent {
	id: string
	revision: number
	actorPlayerId: PlayerId
	actionType: GameAction['type']
	kind: 'played' | 'discarded' | null
	revealedCardDefinitionIds: PlayerCardDefinitionId[]
	monsterId: string | null
}

export interface AuthoritativeOnlineMatch {
	schemaVersion: 1
	revision: number
	gameState: GameState
	processedCommands: ProcessedOnlineCommand[]
}

export interface OnlinePrivateGameState {
	schemaVersion: 1
	revision: number
	playerId: PlayerId
	hand: PlayerCardInstance[]
	selectedCardInstanceIds: CardInstanceId[]
}

export interface OnlineGameSnapshot {
	revision: number
	state: GameState
	event: OnlineGameEvent | null
}

export interface OnlineRematchRequests {
	host: boolean
	guest: boolean
}

export interface OnlinePublicGameFields {
	revision: number
	publicGameState: PublicGameState
	lastGameEvent: OnlineGameEvent | null
}

export const MAX_PROCESSED_ONLINE_COMMANDS = 64
