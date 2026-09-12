import { CORE_CATALOG } from '../definitions/core'
import type {
	GameCatalog,
	MonsterDefinition,
	PlayerCardInstance,
	PlayerId,
} from '../definitions/types'
import { applyGameAction } from '../engine/applyGameAction'
import type { GameAction, GameState } from '../engine/types'
import {
	canDefeatMonster,
	canUseUltimateWeapon,
	getActiveMonsterDefinitions,
	getPlayer,
} from '../selectors/gameSelectors'

export interface ComputerDecisionContext {
	readonly state: GameState
	readonly playerId: PlayerId
	readonly catalog: GameCatalog
}

export type ComputerStrategy = (
	context: ComputerDecisionContext,
) => GameAction | null

function legalAction(
	state: GameState,
	action: GameAction,
	catalog: GameCatalog,
): GameAction | null {
	return applyGameAction(state, action, catalog).ok ? action : null
}

function compareMonsters(
	left: MonsterDefinition,
	right: MonsterDefinition,
	visibleOrder: ReadonlyMap<string, number>,
): number {
	const leftPoints = left.points === 'infinity' ? Number.POSITIVE_INFINITY : left.points
	const rightPoints = right.points === 'infinity' ? Number.POSITIVE_INFINITY : right.points
	return (
		rightPoints - leftPoints ||
		(visibleOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
			(visibleOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER) ||
		left.id.localeCompare(right.id)
	)
}

function getBestMonster(
	state: GameState,
	catalog: GameCatalog,
	predicate: (monster: MonsterDefinition) => boolean,
): MonsterDefinition | undefined {
	const monsters = getActiveMonsterDefinitions(state, catalog)
	const visibleOrder = new Map(monsters.map((monster, index) => [monster.id, index]))
	return monsters
		.filter(predicate)
		.sort((left, right) => compareMonsters(left, right, visibleOrder))[0]
}

function compareActionCards(
	left: PlayerCardInstance,
	right: PlayerCardInstance,
	catalog: GameCatalog,
): number {
	const leftDefinition = catalog.playerCards[left.definitionId]
	const rightDefinition = catalog.playerCards[right.definitionId]
	const leftCount = leftDefinition?.category === 'action' ? leftDefinition.effect.count : 0
	const rightCount = rightDefinition?.category === 'action' ? rightDefinition.effect.count : 0
	const leftDrawCount = typeof leftCount === 'number' ? leftCount : 0
	const rightDrawCount = typeof rightCount === 'number' ? rightCount : 0
	return (
		rightDrawCount - leftDrawCount ||
		left.definitionId.localeCompare(right.definitionId) ||
		left.instanceId.localeCompare(right.instanceId)
	)
}

function compareDiscardCards(
	left: PlayerCardInstance,
	right: PlayerCardInstance,
	catalog: GameCatalog,
): number {
	const categoryOrder = {
		weapon: 0,
		action: 1,
		'ultimate-weapon': 2,
	} as const
	const leftCategory = catalog.playerCards[left.definitionId]?.category
	const rightCategory = catalog.playerCards[right.definitionId]?.category
	return (
		(leftCategory === undefined ? -1 : categoryOrder[leftCategory]) -
			(rightCategory === undefined ? -1 : categoryOrder[rightCategory]) ||
		left.definitionId.localeCompare(right.definitionId) ||
		left.instanceId.localeCompare(right.instanceId)
	)
}

function chooseForcedDiscard(
	state: GameState,
	playerId: PlayerId,
	catalog: GameCatalog,
): GameAction | null {
	const pending = state.pendingDiscard
	if (state.phase !== 'forced-discard' || pending?.playerId !== playerId) {
		return null
	}
	if (pending.selectedCardInstanceIds.length === pending.requiredCount) {
		return legalAction(state, { type: 'CONFIRM_DISCARD', playerId }, catalog)
	}
	const selectedIds = new Set(pending.selectedCardInstanceIds)
	const card = getPlayer(state, playerId)?.hand
		.filter((candidate) => !selectedIds.has(candidate.instanceId))
		.sort((left, right) => compareDiscardCards(left, right, catalog))[0]
	return card
		? legalAction(
				state,
				{ type: 'SELECT_DISCARD', playerId, cardInstanceId: card.instanceId },
				catalog,
			)
		: null
}

/**
 * The initial deterministic strategy. It is deliberately separate from the
 * rules engine and returns only actions accepted by applyGameAction.
 */
export const heuristicComputerStrategy: ComputerStrategy = ({
	state,
	playerId,
	catalog,
}) => {
	const discardAction = chooseForcedDiscard(state, playerId, catalog)
	if (discardAction) {
		return discardAction
	}
	if (
		state.phase !== 'action' ||
		state.turn.currentPlayerId !== playerId ||
		!state.turn.actionPhaseOpen
	) {
		return null
	}
	const player = getPlayer(state, playerId)
	if (!player) {
		return null
	}

	// Playing an Action into an otherwise empty draw/discard supply would only
	// recycle that same Action, so it is not a useful draw.
	if (state.drawPile.length + state.discardPile.length > 0) {
		const actionCard = [...player.hand]
			.filter((card) => catalog.playerCards[card.definitionId]?.category === 'action')
			.sort((left, right) => compareActionCards(left, right, catalog))[0]
		if (actionCard) {
			const action = legalAction(
				state,
				{
					type: 'PLAY_ACTION_CARD',
					playerId,
					cardInstanceId: actionCard.instanceId,
				},
				catalog,
			)
			if (action) {
				return action
			}
		}
	}

	const normalTarget = getBestMonster(state, catalog, (monster) =>
		canDefeatMonster(state, playerId, monster.id, catalog),
	)
	if (normalTarget) {
		return legalAction(
			state,
			{ type: 'DEFEAT_MONSTER', playerId, monsterId: normalTarget.id },
			catalog,
		)
	}

	const ultimateCards = [...player.hand]
		.filter(
			(card) => catalog.playerCards[card.definitionId]?.category === 'ultimate-weapon',
		)
		.sort((left, right) => left.instanceId.localeCompare(right.instanceId))
	for (const ultimateCard of ultimateCards) {
		const ultimateTarget = getBestMonster(state, catalog, (monster) =>
			canUseUltimateWeapon(
				state,
				playerId,
				ultimateCard.instanceId,
				monster.id,
				catalog,
			),
		)
		if (ultimateTarget) {
			return legalAction(
				state,
				{
					type: 'USE_ULTIMATE_WEAPON',
					playerId,
					cardInstanceId: ultimateCard.instanceId,
					monsterId: ultimateTarget.id,
				},
				catalog,
			)
		}
	}

	return legalAction(state, { type: 'SKIP_TURN', playerId }, catalog)
}

export function chooseComputerAction(
	state: GameState,
	playerId: PlayerId,
	catalog: GameCatalog = CORE_CATALOG,
	strategy: ComputerStrategy = heuristicComputerStrategy,
): GameAction | null {
	if (getPlayer(state, playerId)?.controller !== 'computer') {
		return null
	}
	const action = strategy({ state, playerId, catalog })
	return action ? legalAction(state, action, catalog) : null
}
