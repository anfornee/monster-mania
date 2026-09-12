import { CORE_CATALOG } from '../definitions/core'
import type { GameCatalog, PlayerCardInstance } from '../definitions/types'
import { getHandLimit } from '../selectors/gameSelectors'
import { buildPlayerCardInstances } from './createGame'
import { CORE_ACTION_EFFECTS, type ActionEffectRegistry } from './actionEffects'
import type { GameState } from './types'

export interface ValidationResult {
	valid: boolean
	errors: string[]
	warnings: string[]
}

export function validateGameState(
	state: GameState,
	catalog: GameCatalog = CORE_CATALOG,
	actionEffects: ActionEffectRegistry = CORE_ACTION_EFFECTS,
): ValidationResult {
	const errors: string[] = []
	const warnings: string[] = []
	const push = (condition: boolean, message: string) => {
		if (!condition) errors.push(message)
	}

	push(state.schemaVersion === 1, 'Unsupported game-state schema version.')
	push(state.rulesetId === catalog.id, 'Game state and catalog ruleset IDs do not match.')
	push(state.players.length === 2, 'A standard game must contain exactly two players.')
	push(new Set(state.players.map((player) => player.id)).size === state.players.length, 'Player IDs must be unique.')
	push(state.players.some((player) => player.id === state.turn.currentPlayerId), 'Current player does not exist.')

	const cardZones: Array<[string, PlayerCardInstance[]]> = [
		...state.players.map((player): [string, PlayerCardInstance[]] => [`hand:${player.id}`, player.hand]),
		['drawPile', state.drawPile],
		['discardPile', state.discardPile],
		['removedPlayerCards', state.removedPlayerCards],
	]
	const cardLocations = new Map<string, string[]>()
	for (const [zone, cards] of cardZones) {
		for (const card of cards) {
			const locations = cardLocations.get(card.instanceId) ?? []
			locations.push(zone)
			cardLocations.set(card.instanceId, locations)
			push(Boolean(catalog.playerCards[card.definitionId]), `Unknown player-card definition: ${card.definitionId}.`)
		}
	}
	for (const [instanceId, locations] of cardLocations) {
		push(locations.length === 1, `Card ${instanceId} appears in multiple zones: ${locations.join(', ')}.`)
	}
	const expectedCards = buildPlayerCardInstances(catalog)
	const expectedIds = new Set(expectedCards.map((card) => card.instanceId))
	push(cardLocations.size === expectedCards.length, `Expected ${expectedCards.length} player cards, found ${cardLocations.size}.`)
	for (const id of expectedIds) {
		push(cardLocations.has(id), `Missing player-card instance: ${id}.`)
	}
	for (const id of cardLocations.keys()) {
		push(expectedIds.has(id), `Unexpected player-card instance: ${id}.`)
	}

	const categoryCounts = Object.values(catalog.playerCards).reduce(
		(counts, card) => ({
			...counts,
			[card.category]: counts[card.category] + card.copies,
		}),
		{ weapon: 0, action: 0, 'ultimate-weapon': 0 },
	)
	push(categoryCounts.weapon === 18, 'A standard catalog must define 18 Weapon cards.')
	push(categoryCounts.action === 5, 'A standard catalog must define 5 Action cards.')
	push(categoryCounts['ultimate-weapon'] === 1, 'A standard catalog must define 1 Ultimate Weapon.')
	for (const definition of Object.values(catalog.playerCards)) {
		if (definition.category === 'action') {
			push(Boolean(actionEffects[definition.effect.type]), `Unknown Action effect: ${definition.effect.type}.`)
		}
	}

	const monsterZones: Array<[string, string[]]> = [
		['monsterDeck', state.monsterDeck],
		['faceUpMonsterIds', state.faceUpMonsterIds],
		...state.players.map((player): [string, string[]] => [
			`defeated:${player.id}`,
			player.defeatedMonsterIds,
		]),
	]
	const monsterLocations = new Map<string, string[]>()
	for (const [zone, monsterIds] of monsterZones) {
		for (const monsterId of monsterIds) {
			const locations = monsterLocations.get(monsterId) ?? []
			locations.push(zone)
			monsterLocations.set(monsterId, locations)
			push(Boolean(catalog.regularMonsters[monsterId]), `Unknown regular Monster: ${monsterId}.`)
		}
	}
	const expectedMonsterIds = Object.keys(catalog.regularMonsters)
	push(expectedMonsterIds.length === 17, 'A standard catalog must define 17 regular Monsters.')
	for (const monsterId of expectedMonsterIds) {
		push(monsterLocations.has(monsterId), `Missing regular Monster: ${monsterId}.`)
	}
	for (const [monsterId, locations] of monsterLocations) {
		push(locations.length === 1, `Monster ${monsterId} appears in multiple zones: ${locations.join(', ')}.`)
	}

	if (state.phase === 'action') {
		push(state.pendingDiscard === null, 'Action phase cannot have a pending discard.')
		push(state.turn.actionPhaseOpen, 'Action phase must be open during an active turn.')
	}
	if (state.phase === 'forced-discard') {
		push(Boolean(state.pendingDiscard), 'Forced-discard phase requires pending discard data.')
		push(!state.turn.actionPhaseOpen, 'Action phase must close while a discard is pending.')
	}
	if (state.phase === 'game-over') {
		push(Boolean(state.winnerId), 'Game-over state requires a winner.')
		push(!state.turn.actionPhaseOpen, 'Action phase cannot remain open after game over.')
	}
	if (state.pendingDiscard) {
		const pendingPlayer = state.players.find((player) => player.id === state.pendingDiscard?.playerId)
		push(Boolean(pendingPlayer), 'Pending discard player does not exist.')
		push(state.pendingDiscard.requiredCount > 0, 'Pending discard count must be positive.')
		push(
			state.pendingDiscard.selectedCardInstanceIds.length <= state.pendingDiscard.requiredCount,
			'Too many discard cards are selected.',
		)
		push(
			state.pendingDiscard.selectedCardInstanceIds.every((id) =>
				pendingPlayer?.hand.some((card) => card.instanceId === id),
			),
			'Pending discard selection contains a card outside the player hand.',
		)
	}

	const handLimit = getHandLimit(state)
	for (const player of state.players) {
		const setupDiscardActive = state.pendingDiscard?.reason === 'sudden-death-setup'
		const isPendingPlayer = state.pendingDiscard?.playerId === player.id
		const allowedOverLimit =
			state.phase === 'forced-discard' && (isPendingPlayer || setupDiscardActive)
		push(player.hand.length <= handLimit || allowedOverLimit, `${player.name}'s hand exceeds the current limit.`)
	}

	if (state.mode === 'regular') {
		push(state.activeSuddenDeathMonsterId === null, 'Regular mode cannot expose a Sudden Death Monster.')
	}
	if (state.mode === 'sudden-death') {
		push(
			state.activeSuddenDeathMonsterId === catalog.suddenDeathMonster.id,
			'Sudden Death must expose the catalog Sudden Death Monster.',
		)
		push(state.faceUpMonsterIds.length === 0, 'Regular Monsters cannot remain face-up during Sudden Death.')
		const playableUltimates = cardZones
			.filter(([zone]) => zone !== 'removedPlayerCards')
			.flatMap(([, cards]) => cards)
			.filter((card) => catalog.playerCards[card.definitionId]?.category === 'ultimate-weapon')
		push(playableUltimates.length === 0, 'Ultimate Weapons must be removed before Sudden Death.')
	}
	if (state.winnerId) {
		push(state.players.some((player) => player.id === state.winnerId), 'Winner does not identify a player.')
	}

	return { valid: errors.length === 0, errors, warnings }
}
