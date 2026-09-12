import type {
	CardInstanceId,
	MonsterId,
	PlayerCardInstance,
	PlayerId,
} from '../definitions/types'

export type PlayerController = 'human-local' | 'human-remote' | 'computer'
export type GameMode = 'regular' | 'sudden-death'
export type GamePhase = 'action' | 'forced-discard' | 'game-over'

export interface PlayerState {
	id: PlayerId
	name: string
	controller: PlayerController
	hand: PlayerCardInstance[]
	defeatedMonsterIds: MonsterId[]
}

export interface PendingDiscard {
	playerId: PlayerId
	requiredCount: number
	selectedCardInstanceIds: CardInstanceId[]
	reason: 'action' | 'skip' | 'sudden-death-setup'
	remainingSetupPlayerIds: PlayerId[]
}

export interface GameEvent {
	id: number
	type:
		| 'game-started'
		| 'turn-started'
		| 'action-played'
		| 'cards-drawn'
		| 'card-discarded'
		| 'player-skipped'
		| 'monster-defeated'
		| 'ultimate-used'
		| 'draw-deck-recycled'
		| 'monsters-rotated'
		| 'sudden-death-started'
		| 'game-won'
	message: string
}

export interface GameState {
	schemaVersion: 1
	rulesetId: string
	players: PlayerState[]
	mode: GameMode
	phase: GamePhase
	turn: {
		number: number
		currentPlayerId: PlayerId
		actionPhaseOpen: boolean
		monsterDefeated: boolean
	}
	drawPile: PlayerCardInstance[]
	discardPile: PlayerCardInstance[]
	removedPlayerCards: PlayerCardInstance[]
	monsterDeck: MonsterId[]
	faceUpMonsterIds: MonsterId[]
	activeSuddenDeathMonsterId: MonsterId | null
	pendingDiscard: PendingDiscard | null
	winnerId: PlayerId | null
	events: GameEvent[]
	nextEventId: number
	rngState: number
}

export type GameAction =
	| { type: 'PLAY_ACTION_CARD'; playerId: PlayerId; cardInstanceId: CardInstanceId }
	| { type: 'DEFEAT_MONSTER'; playerId: PlayerId; monsterId: MonsterId }
	| {
			type: 'USE_ULTIMATE_WEAPON'
			playerId: PlayerId
			cardInstanceId: CardInstanceId
			monsterId: MonsterId
	  }
	| { type: 'SELECT_DISCARD'; playerId: PlayerId; cardInstanceId: CardInstanceId }
	| { type: 'CONFIRM_DISCARD'; playerId: PlayerId }
	| { type: 'SKIP_TURN'; playerId: PlayerId }

export interface GameActionResult {
	ok: boolean
	state: GameState
	error?: string
}

export interface CreateGameOptions {
	seed?: number
	startingPlayerId?: PlayerId
	players: Array<Pick<PlayerState, 'id' | 'name' | 'controller'>>
}
