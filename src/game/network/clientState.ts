import type { PlayerCardInstance, PlayerId } from '../definitions/types'
import type {
	GameEvent,
	GameMode,
	GamePhase,
	GameState,
	PendingDiscard,
	PlayerController,
} from '../engine/types'

export interface PublicPlayerState {
	id: PlayerId
	name: string
	controller: PlayerController
	handCount: number
	defeatedMonsterIds: string[]
}

export type PublicPendingDiscard = Pick<
	PendingDiscard,
	'playerId' | 'requiredCount' | 'reason'
> & {
	selectedCount: number
}

export interface PublicGameState {
	schemaVersion: 1
	rulesetId: string
	players: PublicPlayerState[]
	mode: GameMode
	phase: GamePhase
	turn: GameState['turn']
	drawPileCount: number
	discardPileCount: number
	removedPlayerCardCount: number
	monsterDeckCount: number
	faceUpMonsterIds: string[]
	activeSuddenDeathMonsterId: string | null
	pendingDiscard: PublicPendingDiscard | null
	winnerId: PlayerId | null
	events: GameEvent[]
}

export interface ClientGameState {
	myPlayerId: PlayerId
	myHand: PlayerCardInstance[]
	privateSelectedCardInstanceIds?: string[]
	publicState: PublicGameState
}

export function createClientGameState(
	state: GameState,
	viewerId: PlayerId,
): ClientGameState {
	const viewer = state.players.find((player) => player.id === viewerId)
	if (!viewer) {
		throw new Error('Cannot create client state for a player outside the game.')
	}

	return {
		myPlayerId: viewerId,
		myHand: structuredClone(viewer.hand),
		publicState: {
			schemaVersion: state.schemaVersion,
			rulesetId: state.rulesetId,
			players: state.players.map((player) => ({
				id: player.id,
				name: player.name,
				controller: player.controller,
				handCount: player.hand.length,
				defeatedMonsterIds: [...player.defeatedMonsterIds],
			})),
			mode: state.mode,
			phase: state.phase,
			turn: { ...state.turn },
			drawPileCount: state.drawPile.length,
			discardPileCount: state.discardPile.length,
			removedPlayerCardCount: state.removedPlayerCards.length,
			monsterDeckCount: state.monsterDeck.length,
			faceUpMonsterIds: [...state.faceUpMonsterIds],
			activeSuddenDeathMonsterId: state.activeSuddenDeathMonsterId,
			pendingDiscard: state.pendingDiscard
				? {
					playerId: state.pendingDiscard.playerId,
					requiredCount: state.pendingDiscard.requiredCount,
					reason: state.pendingDiscard.reason,
					selectedCount: state.pendingDiscard.selectedCardInstanceIds.length,
				}
				: null,
			winnerId: state.winnerId,
			events: structuredClone(state.events),
		},
	}
}

export function serializeClientGameState(
	state: GameState,
	viewerId: PlayerId,
): string {
	return JSON.stringify(createClientGameState(state, viewerId))
}
