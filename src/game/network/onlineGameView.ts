import type { PlayerCardInstance } from '../definitions/types'
import type { GameState } from '../engine/types'
import type { ClientGameState, PublicGameState } from './clientState'
import type { OnlinePrivateGameState } from './onlineGame'

function hiddenCards(zone: string, count: number): PlayerCardInstance[] {
	return Array.from({ length: count }, (_, index) => ({
		instanceId: `hidden-${zone}-${index}`,
		definitionId: 'hidden',
	}))
}

export function combineOnlineGameView(
	publicState: PublicGameState,
	privateState: OnlinePrivateGameState,
): ClientGameState {
	return {
		myPlayerId: privateState.playerId,
		myHand: structuredClone(privateState.hand),
		privateSelectedCardInstanceIds: [...privateState.selectedCardInstanceIds],
		publicState: structuredClone(publicState),
	}
}

export function materializeClientGameState(view: ClientGameState): GameState {
	const selectedIds = view.publicState.pendingDiscard?.playerId === view.myPlayerId
		? view.privateSelectedCardInstanceIds ?? []
		: []
	return {
		schemaVersion: view.publicState.schemaVersion,
		rulesetId: view.publicState.rulesetId,
		players: view.publicState.players.map((player) => ({
			id: player.id,
			name: player.name,
			controller: player.controller,
			hand: player.id === view.myPlayerId
				? structuredClone(view.myHand)
				: hiddenCards(`hand-${player.id}`, player.handCount),
			defeatedMonsterIds: [...player.defeatedMonsterIds],
		})),
		mode: view.publicState.mode,
		phase: view.publicState.phase,
		turn: { ...view.publicState.turn },
		drawPile: hiddenCards('draw', view.publicState.drawPileCount),
		discardPile: hiddenCards('discard', view.publicState.discardPileCount),
		removedPlayerCards: hiddenCards('removed', view.publicState.removedPlayerCardCount),
		monsterDeck: Array.from(
			{ length: view.publicState.monsterDeckCount },
			(_, index) => `hidden-monster-${index}`,
		),
		faceUpMonsterIds: [...view.publicState.faceUpMonsterIds],
		activeSuddenDeathMonsterId: view.publicState.activeSuddenDeathMonsterId,
		pendingDiscard: view.publicState.pendingDiscard
			? {
				playerId: view.publicState.pendingDiscard.playerId,
				requiredCount: view.publicState.pendingDiscard.requiredCount,
				selectedCardInstanceIds: selectedIds,
				reason: view.publicState.pendingDiscard.reason,
				remainingSetupPlayerIds: [],
			}
			: null,
		winnerId: view.publicState.winnerId,
		events: structuredClone(view.publicState.events),
		nextEventId: (view.publicState.events.at(-1)?.id ?? 0) + 1,
		rngState: 0,
	}
}
