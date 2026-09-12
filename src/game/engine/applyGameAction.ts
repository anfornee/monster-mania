import { CORE_CATALOG } from '../definitions/core'
import type { GameCatalog, PlayerCardInstance, PlayerId } from '../definitions/types'
import {
	canDefeatMonster,
	canUseUltimateWeapon,
	getHandLimit,
	getOpponent,
	getPlayer,
	getPlayerScore,
	getRequiredWeaponInstances,
} from '../selectors/gameSelectors'
import { shuffleWithSeed } from './random'
import { CORE_ACTION_EFFECTS, type ActionEffectRegistry } from './actionEffects'
import type { GameAction, GameActionResult, GameEvent, GameState } from './types'

function fail(state: GameState, error: string): GameActionResult {
	return { ok: false, state, error }
}

function addEvent(
	state: GameState,
	type: GameEvent['type'],
	message: string,
): void {
	state.events.push({ id: state.nextEventId, type, message })
	state.nextEventId += 1
	if (state.events.length > 30) {
		state.events = state.events.slice(-30)
	}
}

function recycleDrawPile(state: GameState): void {
	if (state.drawPile.length > 0 || state.discardPile.length === 0) {
		return
	}
	const undefeatedCount = state.monsterDeck.length + state.faceUpMonsterIds.length
	if (state.mode === 'regular' && undefeatedCount >= 4) {
		state.monsterDeck.push(...state.faceUpMonsterIds)
		state.faceUpMonsterIds = state.monsterDeck.splice(0, 2)
		addEvent(state, 'monsters-rotated', 'The face-up Monsters rotated as the Draw pile recycled.')
	}
	const shuffled = shuffleWithSeed(state.discardPile, state.rngState)
	state.drawPile = shuffled.values
	state.discardPile = []
	state.rngState = shuffled.seed
	addEvent(state, 'draw-deck-recycled', 'The shared discard pile became the new Draw pile.')
}

function drawCards(state: GameState, playerId: PlayerId, count: number): number {
	const player = getPlayer(state, playerId)
	if (!player) {
		return 0
	}
	let drawn = 0
	for (let index = 0; index < count; index += 1) {
		recycleDrawPile(state)
		const card = state.drawPile.shift()
		if (!card) {
			break
		}
		player.hand.push(card)
		drawn += 1
	}
	if (drawn > 0) {
		addEvent(state, 'cards-drawn', `${player.name} drew ${drawn} card${drawn === 1 ? '' : 's'}.`)
	}
	return drawn
}

function advanceTurn(state: GameState): void {
	const nextPlayer = getOpponent(state, state.turn.currentPlayerId)
	state.turn = {
		number: state.turn.number + 1,
		currentPlayerId: nextPlayer.id,
		actionPhaseOpen: true,
		monsterDefeated: false,
	}
	state.phase = 'action'
	state.pendingDiscard = null
	addEvent(state, 'turn-started', `${nextPlayer.name}'s turn began.`)
}

function removeCardsFromHand(
	state: GameState,
	playerId: PlayerId,
	cards: PlayerCardInstance[],
): void {
	const player = getPlayer(state, playerId)
	if (!player) {
		return
	}
	const ids = new Set(cards.map((card) => card.instanceId))
	player.hand = player.hand.filter((card) => !ids.has(card.instanceId))
	state.discardPile.push(...cards)
}

function enterForcedDiscard(
	state: GameState,
	playerId: PlayerId,
	requiredCount: number,
	reason: 'action' | 'skip' | 'sudden-death-setup',
	remainingSetupPlayerIds: PlayerId[] = [],
): void {
	state.phase = 'forced-discard'
	state.turn.actionPhaseOpen = false
	state.pendingDiscard = {
		playerId,
		requiredCount,
		selectedCardInstanceIds: [],
		reason,
		remainingSetupPlayerIds,
	}
}

function removeUltimateWeapons(state: GameState, catalog: GameCatalog): void {
	const isUltimate = (card: PlayerCardInstance) =>
		catalog.playerCards[card.definitionId]?.category === 'ultimate-weapon'
	for (const player of state.players) {
		const removed = player.hand.filter(isUltimate)
		player.hand = player.hand.filter((card) => !isUltimate(card))
		state.removedPlayerCards.push(...removed)
	}
	for (const zone of ['drawPile', 'discardPile'] as const) {
		const removed = state[zone].filter(isUltimate)
		state[zone] = state[zone].filter((card) => !isUltimate(card))
		state.removedPlayerCards.push(...removed)
	}
}

function startSuddenDeath(state: GameState, catalog: GameCatalog): void {
	removeUltimateWeapons(state, catalog)
	state.mode = 'sudden-death'
	state.activeSuddenDeathMonsterId = catalog.suddenDeathMonster.id
	state.faceUpMonsterIds = []
	state.monsterDeck = []
	state.turn.currentPlayerId = getOpponent(state, state.turn.currentPlayerId).id
	state.turn.number += 1
	state.turn.monsterDefeated = false
	addEvent(state, 'sudden-death-started', 'The score is tied. The Infinity Beast enters the arena!')
	const playersOverLimit = state.players.filter((player) => player.hand.length > 4)
	const first = playersOverLimit[0]
	if (first) {
		enterForcedDiscard(
			state,
			first.id,
			first.hand.length - 4,
			'sudden-death-setup',
			playersOverLimit.slice(1).map((player) => player.id),
		)
		return
	}
	state.phase = 'action'
	state.pendingDiscard = null
	state.turn.actionPhaseOpen = true
}

function finishRegularMonsterDefeat(state: GameState, catalog: GameCatalog): void {
	const undefeatedCount = state.monsterDeck.length + state.faceUpMonsterIds.length
	if (undefeatedCount === 0) {
		const scores = state.players.map((player) => ({
			player,
			score: getPlayerScore(state, player.id, catalog),
		}))
		const highScore = Math.max(...scores.map(({ score }) => score))
		const leaders = scores.filter(({ score }) => score === highScore)
		if (leaders.length === 1) {
			const winner = leaders[0].player
			state.phase = 'game-over'
			state.winnerId = winner.id
			state.turn.actionPhaseOpen = false
			addEvent(state, 'game-won', `${winner.name} wins with ${highScore} points!`)
			return
		}
		startSuddenDeath(state, catalog)
		return
	}
	if (undefeatedCount === 3) {
		state.faceUpMonsterIds.push(...state.monsterDeck)
		state.monsterDeck = []
	} else if (undefeatedCount > 3) {
		const replacement = state.monsterDeck.shift()
		if (replacement) {
			state.faceUpMonsterIds.push(replacement)
		}
	}
	advanceTurn(state)
}

function defeatRegularMonster(
	state: GameState,
	playerId: PlayerId,
	monsterId: string,
	catalog: GameCatalog,
): void {
	const player = getPlayer(state, playerId)
	const definition = catalog.regularMonsters[monsterId]
	if (!player || !definition) {
		return
	}
	state.faceUpMonsterIds = state.faceUpMonsterIds.filter((id) => id !== monsterId)
	player.defeatedMonsterIds.push(monsterId)
	state.turn.monsterDefeated = true
	state.turn.actionPhaseOpen = false
	addEvent(state, 'monster-defeated', `${player.name} defeated ${definition.name} for ${definition.points} point${definition.points === 1 ? '' : 's'}.`)
	finishRegularMonsterDefeat(state, catalog)
}

function playActionCard(
	state: GameState,
	action: Extract<GameAction, { type: 'PLAY_ACTION_CARD' }>,
	catalog: GameCatalog,
	actionEffects: ActionEffectRegistry,
): GameActionResult {
	if (
		state.phase !== 'action' ||
		!state.turn.actionPhaseOpen ||
		state.turn.currentPlayerId !== action.playerId
	) {
		return fail(state, 'Action cards may only be played by the current player during the Action Phase.')
	}
	const player = getPlayer(state, action.playerId)
	const card = player?.hand.find((candidate) => candidate.instanceId === action.cardInstanceId)
	const definition = catalog.playerCards[card?.definitionId ?? '']
	if (!player || !card || definition?.category !== 'action') {
		return fail(state, 'That Action card is not in the player\'s hand.')
	}
	const effectHandler = actionEffects[definition.effect.type]
	if (!effectHandler) {
		return fail(state, `Unknown Action effect: ${definition.effect.type}.`)
	}
	const next = structuredClone(state)
	const nextPlayer = getPlayer(next, action.playerId)!
	nextPlayer.hand = nextPlayer.hand.filter((candidate) => candidate.instanceId !== card.instanceId)
	next.discardPile.push(card)
	addEvent(next, 'action-played', `${nextPlayer.name} played ${definition.name}.`)
	try {
		effectHandler({
			state: next,
			playerId: action.playerId,
			effect: definition.effect,
			drawCards: (count) => drawCards(next, action.playerId, count),
		})
	} catch (error) {
		return fail(state, error instanceof Error ? error.message : 'The Action effect failed.')
	}
	const excess = nextPlayer.hand.length - getHandLimit(next)
	if (excess > 0) {
		enterForcedDiscard(next, action.playerId, excess, 'action')
	}
	return { ok: true, state: next }
}

function defeatMonster(
	state: GameState,
	action: Extract<GameAction, { type: 'DEFEAT_MONSTER' }>,
	catalog: GameCatalog,
): GameActionResult {
	if (!canDefeatMonster(state, action.playerId, action.monsterId, catalog)) {
		return fail(state, 'The selected Monster cannot be defeated with the current hand.')
	}
	const next = structuredClone(state)
	const player = getPlayer(next, action.playerId)!
	const definition =
		next.mode === 'sudden-death'
			? catalog.suddenDeathMonster
			: catalog.regularMonsters[action.monsterId]
	const requiredCards = getRequiredWeaponInstances(
		player.hand,
		definition.requiredWeapons,
		catalog,
	)!
	removeCardsFromHand(next, action.playerId, requiredCards)
	if (next.mode === 'sudden-death') {
		next.phase = 'game-over'
		next.winnerId = action.playerId
		next.turn.actionPhaseOpen = false
		addEvent(next, 'game-won', `${player.name} defeated The Infinity Beast and wins!`)
		return { ok: true, state: next }
	}
	defeatRegularMonster(next, action.playerId, action.monsterId, catalog)
	return { ok: true, state: next }
}

function playUltimateWeapon(
	state: GameState,
	action: Extract<GameAction, { type: 'USE_ULTIMATE_WEAPON' }>,
	catalog: GameCatalog,
): GameActionResult {
	if (!canUseUltimateWeapon(state, action.playerId, action.cardInstanceId, action.monsterId, catalog)) {
		return fail(state, 'That Ultimate Weapon cannot target the selected Monster.')
	}
	const next = structuredClone(state)
	const player = getPlayer(next, action.playerId)!
	const card = player.hand.find((candidate) => candidate.instanceId === action.cardInstanceId)!
	removeCardsFromHand(next, action.playerId, [card])
	addEvent(next, 'ultimate-used', `${player.name} unleashed ${catalog.playerCards[card.definitionId].name}.`)
	defeatRegularMonster(next, action.playerId, action.monsterId, catalog)
	return { ok: true, state: next }
}

function selectDiscard(
	state: GameState,
	action: Extract<GameAction, { type: 'SELECT_DISCARD' }>,
): GameActionResult {
	const pending = state.pendingDiscard
	if (state.phase !== 'forced-discard' || !pending || pending.playerId !== action.playerId) {
		return fail(state, 'No discard selection is pending for that player.')
	}
	const player = getPlayer(state, action.playerId)
	if (!player?.hand.some((card) => card.instanceId === action.cardInstanceId)) {
		return fail(state, 'That card is not available to discard.')
	}
	const next = structuredClone(state)
	const selected = next.pendingDiscard!.selectedCardInstanceIds
	const existingIndex = selected.indexOf(action.cardInstanceId)
	if (existingIndex >= 0) {
		selected.splice(existingIndex, 1)
	} else if (selected.length < pending.requiredCount) {
		selected.push(action.cardInstanceId)
	} else {
		return fail(state, `Select exactly ${pending.requiredCount} card${pending.requiredCount === 1 ? '' : 's'}.`)
	}
	return { ok: true, state: next }
}

function confirmDiscard(
	state: GameState,
	action: Extract<GameAction, { type: 'CONFIRM_DISCARD' }>,
): GameActionResult {
	const pending = state.pendingDiscard
	if (state.phase !== 'forced-discard' || !pending || pending.playerId !== action.playerId) {
		return fail(state, 'No discard is pending for that player.')
	}
	if (pending.selectedCardInstanceIds.length !== pending.requiredCount) {
		return fail(state, `Select exactly ${pending.requiredCount} card${pending.requiredCount === 1 ? '' : 's'} first.`)
	}
	const next = structuredClone(state)
	const nextPending = next.pendingDiscard!
	const player = getPlayer(next, action.playerId)!
	const selectedIds = new Set(nextPending.selectedCardInstanceIds)
	const selectedCards = player.hand.filter((card) => selectedIds.has(card.instanceId))
	removeCardsFromHand(next, action.playerId, selectedCards)
	addEvent(
		next,
		'card-discarded',
		`${player.name} discarded ${selectedCards.length} card${selectedCards.length === 1 ? '' : 's'}.`,
	)
	if (nextPending.reason === 'skip') {
		drawCards(next, action.playerId, 1)
		addEvent(next, 'player-skipped', `${player.name} skipped the turn.`)
		advanceTurn(next)
		return { ok: true, state: next }
	}
	if (nextPending.reason === 'sudden-death-setup') {
		const nextPlayerId = nextPending.remainingSetupPlayerIds[0]
		if (nextPlayerId) {
			const setupPlayer = getPlayer(next, nextPlayerId)!
			enterForcedDiscard(
				next,
				nextPlayerId,
				setupPlayer.hand.length - 4,
				'sudden-death-setup',
				nextPending.remainingSetupPlayerIds.slice(1),
			)
			return { ok: true, state: next }
		}
	}
	next.phase = 'action'
	next.pendingDiscard = null
	next.turn.actionPhaseOpen = true
	return { ok: true, state: next }
}

function skipTurn(
	state: GameState,
	action: Extract<GameAction, { type: 'SKIP_TURN' }>,
): GameActionResult {
	if (state.phase !== 'action' || state.turn.currentPlayerId !== action.playerId) {
		return fail(state, 'Only the current player may skip during an active turn.')
	}
	const next = structuredClone(state)
	const player = getPlayer(next, action.playerId)!
	if (player.hand.length === getHandLimit(next)) {
		enterForcedDiscard(next, action.playerId, 1, 'skip')
		return { ok: true, state: next }
	}
	drawCards(next, action.playerId, 1)
	addEvent(next, 'player-skipped', `${player.name} skipped the turn.`)
	advanceTurn(next)
	return { ok: true, state: next }
}

export function applyGameAction(
	state: GameState,
	action: GameAction,
	catalog: GameCatalog = CORE_CATALOG,
	actionEffects: ActionEffectRegistry = CORE_ACTION_EFFECTS,
): GameActionResult {
	switch (action.type) {
		case 'PLAY_ACTION_CARD':
			return playActionCard(state, action, catalog, actionEffects)
		case 'DEFEAT_MONSTER':
			return defeatMonster(state, action, catalog)
		case 'USE_ULTIMATE_WEAPON':
			return playUltimateWeapon(state, action, catalog)
		case 'SELECT_DISCARD':
			return selectDiscard(state, action)
		case 'CONFIRM_DISCARD':
			return confirmDiscard(state, action)
		case 'SKIP_TURN':
			return skipTurn(state, action)
	}
}
