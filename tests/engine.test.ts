import { describe, expect, it } from 'vitest'
import { CORE_CATALOG } from '../src/game/definitions/core'
import { runComputerTurn } from '../src/game/ai'
import type { GameCatalog, PlayerCardDefinition, PlayerCardInstance } from '../src/game/definitions/types'
import { CORE_ACTION_EFFECTS, type ActionEffectRegistry } from '../src/game/engine/actionEffects'
import { applyGameAction } from '../src/game/engine/applyGameAction'
import { buildPlayerCardInstances, createGame } from '../src/game/engine/createGame'
import type { GameState } from '../src/game/engine/types'
import { validateGameState } from '../src/game/engine/validateGameState'
import { createSandboxScenario, SANDBOX_PRESETS } from '../src/game/sandbox/presets'
import { canDefeatMonster, getPlayerScore } from '../src/game/selectors/gameSelectors'
import { isResumableGame, restoreGame, serializeGame } from '../src/game/serialization/gameStorage'

function newGame(): GameState {
	return createGame({
		seed: 42,
		startingPlayerId: 'player-1',
		players: [
			{ id: 'player-1', name: 'Player 1', controller: 'human-local' },
			{ id: 'player-2', name: 'Player 2', controller: 'human-remote' },
		],
	})
}

function allCards(state: GameState): PlayerCardInstance[] {
	return [
		...state.players.flatMap((player) => player.hand),
		...state.drawPile,
		...state.discardPile,
		...state.removedPlayerCards,
	]
}

function swapDefinitionIntoHand(
	state: GameState,
	playerId: string,
	definitionId: string,
	replaceIndex = 0,
): void {
	const player = state.players.find((candidate) => candidate.id === playerId)!
	if (player.hand.some((card) => card.definitionId === definitionId)) return
	const zones = [state.drawPile, state.discardPile, ...state.players.map((candidate) => candidate.hand)]
	for (const zone of zones) {
		const index = zone.findIndex((card) => card.definitionId === definitionId)
		if (index >= 0) {
			const incoming = zone[index]
			zone[index] = player.hand[replaceIndex]
			player.hand[replaceIndex] = incoming
			return
		}
	}
	throw new Error(`No ${definitionId} card is available.`)
}

function ensureDefinitionsInHand(
	state: GameState,
	playerId: string,
	definitionIds: string[],
): void {
	const player = state.players.find((candidate) => candidate.id === playerId)!
	const requiredCounts = new Map<string, number>()
	for (const definitionId of definitionIds) {
		requiredCounts.set(definitionId, (requiredCounts.get(definitionId) ?? 0) + 1)
	}
	for (const [definitionId, requiredCount] of requiredCounts) {
		while (player.hand.filter((card) => card.definitionId === definitionId).length < requiredCount) {
			const source = [state.drawPile, state.discardPile, ...state.players.filter((candidate) => candidate.id !== playerId).map((candidate) => candidate.hand)]
				.find((zone) => zone.some((card) => card.definitionId === definitionId))
			const sourceIndex = source?.findIndex((card) => card.definitionId === definitionId) ?? -1
			if (!source || sourceIndex < 0) throw new Error(`No ${definitionId} card is available.`)
			const incoming = source[sourceIndex]
			if (player.hand.length < 5) {
				player.hand.push(incoming)
				source.splice(sourceIndex, 1)
				continue
			}
			const replaceIndex = player.hand.findIndex((card) => {
				const protectedCount = requiredCounts.get(card.definitionId) ?? 0
				const currentCount = player.hand.filter((candidate) => candidate.definitionId === card.definitionId).length
				return protectedCount === 0 || currentCount > protectedCount
			})
			if (replaceIndex < 0) throw new Error('No replaceable hand card is available.')
			source[sourceIndex] = player.hand[replaceIndex]
			player.hand[replaceIndex] = incoming
		}
	}
}

describe('standard setup', () => {
	it('builds the standard 18 / 5 / 1 player deck and 17 + 1 Monsters', () => {
		const cards = buildPlayerCardInstances(CORE_CATALOG)
		const categories = cards.map((card) => CORE_CATALOG.playerCards[card.definitionId].category)
		expect(cards).toHaveLength(24)
		expect(categories.filter((category) => category === 'weapon')).toHaveLength(18)
		expect(categories.filter((category) => category === 'action')).toHaveLength(5)
		expect(categories.filter((category) => category === 'ultimate-weapon')).toHaveLength(1)
		expect(Object.keys(CORE_CATALOG.regularMonsters)).toHaveLength(17)
		expect(CORE_CATALOG.suddenDeathMonster.isSuddenDeath).toBe(true)
	})

	it('deals three cards each, reveals two Monsters, and validates', () => {
		const state = newGame()
		expect(state.players.map((player) => player.hand.length)).toEqual([3, 3])
		expect(state.faceUpMonsterIds).toHaveLength(2)
		expect(validateGameState(state)).toMatchObject({ valid: true, errors: [] })
	})

	it('creates the same game from the same seed', () => {
		expect(newGame()).toEqual(newGame())
	})

	it('uses a proper player name in third-person narration', () => {
		const state = createGame({
			seed: 9,
			startingPlayerId: 'player-1',
			players: [
				{ id: 'player-1', name: 'Anthony', controller: 'human-local' },
				{ id: 'player-2', name: 'Mayhem Bot', controller: 'computer' },
			],
		})
		expect(state.events[0].message).toBe('Anthony takes the first turn.')
		expect(applyGameAction(state, { type: 'SKIP_TURN', playerId: 'player-1' }).state.events)
			.toEqual(expect.arrayContaining([
				expect.objectContaining({ message: 'Anthony skipped the turn.' }),
			]))
	})
})

describe('Action timing and hand cleanup', () => {
	it('plays multiple Actions and allows a newly drawn Action immediately', () => {
		let state = createSandboxScenario('action-chain').state
		const drawTwo = state.players[0].hand.find((card) => card.definitionId === 'draw-2')!
		let result = applyGameAction(state, {
			type: 'PLAY_ACTION_CARD',
			playerId: 'player-1',
			cardInstanceId: drawTwo.instanceId,
		})
		expect(result.ok).toBe(true)
		state = result.state
		const drawOne = state.players[0].hand.find((card) => card.definitionId === 'draw-1')!
		result = applyGameAction(state, {
			type: 'PLAY_ACTION_CARD',
			playerId: 'player-1',
			cardInstanceId: drawOne.instanceId,
		})
		expect(result.ok).toBe(true)
		expect(result.state.turn.currentPlayerId).toBe('player-1')
		expect(result.state.discardPile.map((card) => card.definitionId)).toEqual(
			expect.arrayContaining(['draw-2', 'draw-1']),
		)
	})

	it('draws the full Draw 2 amount before requiring cleanup', () => {
		const state = createSandboxScenario('draw-2-over-limit').state
		const action = state.players[0].hand.find((card) => card.definitionId === 'draw-2')!
		const result = applyGameAction(state, {
			type: 'PLAY_ACTION_CARD',
			playerId: 'player-1',
			cardInstanceId: action.instanceId,
		})
		expect(result.ok).toBe(true)
		expect(result.state.players[0].hand).toHaveLength(6)
		expect(result.state.pendingDiscard?.requiredCount).toBe(1)
		expect(result.state.phase).toBe('forced-discard')
	})

	it('rejects voluntary discard and resumes Actions after required cleanup', () => {
		let state = createSandboxScenario('draw-2-over-limit').state
		const voluntary = applyGameAction(state, {
			type: 'SELECT_DISCARD',
			playerId: 'player-1',
			cardInstanceId: state.players[0].hand[0].instanceId,
		})
		expect(voluntary.ok).toBe(false)
		const drawTwo = state.players[0].hand.find((card) => card.definitionId === 'draw-2')!
		state = applyGameAction(state, {
			type: 'PLAY_ACTION_CARD',
			playerId: 'player-1',
			cardInstanceId: drawTwo.instanceId,
		}).state
		const discardId = state.players[0].hand[0].instanceId
		state = applyGameAction(state, {
			type: 'SELECT_DISCARD',
			playerId: 'player-1',
			cardInstanceId: discardId,
		}).state
		const confirmed = applyGameAction(state, { type: 'CONFIRM_DISCARD', playerId: 'player-1' })
		expect(confirmed.ok).toBe(true)
		expect(confirmed.state.phase).toBe('action')
		expect(confirmed.state.turn.actionPhaseOpen).toBe(true)
		expect(confirmed.state.players[0].hand).toHaveLength(5)
	})
})

describe('Monster defeat and Ultimate Weapons', () => {
	it('requires the exact Weapon types and consumes only required instances', () => {
		const beatable = createSandboxScenario('beatable-monster').state
		expect(canDefeatMonster(beatable, 'player-1', 'ground-worm', CORE_CATALOG)).toBe(true)
		const beforeOpponentHand = beatable.players[1].hand
		const result = applyGameAction(beatable, {
			type: 'DEFEAT_MONSTER',
			playerId: 'player-1',
			monsterId: 'ground-worm',
		})
		expect(result.ok).toBe(true)
		expect(result.state.discardPile.map((card) => card.definitionId)).toEqual(
			expect.arrayContaining(['grenade', 'gun', 'mace']),
		)
		expect(result.state.players[0].defeatedMonsterIds).toContain('ground-worm')
		expect(result.state.players[1].hand).toEqual(beforeOpponentHand)
		expect(result.state.turn.currentPlayerId).toBe('player-2')
	})

	it('rejects missing requirements and a second action by the old player', () => {
		const unbeatable = createSandboxScenario('unbeatable-monster').state
		expect(
			applyGameAction(unbeatable, {
				type: 'DEFEAT_MONSTER',
				playerId: 'player-1',
				monsterId: 'thing',
			}).ok,
		).toBe(false)
		const beatable = createSandboxScenario('beatable-monster').state
		const defeated = applyGameAction(beatable, {
			type: 'DEFEAT_MONSTER',
			playerId: 'player-1',
			monsterId: 'ground-worm',
		}).state
		expect(
			applyGameAction(defeated, {
				type: 'SKIP_TURN',
				playerId: 'player-1',
			}).ok,
		).toBe(false)
	})

	it('Black Hole discards only itself, leaves Weapons, and cannot enter Sudden Death', () => {
		const state = createSandboxScenario('black-hole-ready').state
		const blackHole = state.players[0].hand.find((card) => card.definitionId === 'black-hole')!
		const weaponIds = state.players[0].hand
			.filter((card) => card.definitionId !== 'black-hole')
			.map((card) => card.instanceId)
		const result = applyGameAction(state, {
			type: 'USE_ULTIMATE_WEAPON',
			playerId: 'player-1',
			cardInstanceId: blackHole.instanceId,
			monsterId: 'thing',
		})
		expect(result.ok).toBe(true)
		expect(result.state.discardPile.map((card) => card.instanceId)).toContain(blackHole.instanceId)
		expect(result.state.players[0].hand.map((card) => card.instanceId)).toEqual(weaponIds)
		const sudden = createSandboxScenario('sudden-death').state
		expect(allCards(sudden).filter((card) => card.definitionId === 'black-hole')).toHaveLength(1)
		expect(sudden.removedPlayerCards[0].definitionId).toBe('black-hole')
	})
})

describe('skip, recycling, and Monster lifecycle', () => {
	it('skip below the limit draws once and immediately changes turns', () => {
		const state = newGame()
		const result = applyGameAction(state, { type: 'SKIP_TURN', playerId: 'player-1' })
		expect(result.ok).toBe(true)
		expect(result.state.players[0].hand).toHaveLength(4)
		expect(result.state.turn.currentPlayerId).toBe('player-2')
	})

	it('skip at the limit discards first, draws one, then ends', () => {
		let state = createSandboxScenario('draw-2-over-limit').state
		const skip = applyGameAction(state, { type: 'SKIP_TURN', playerId: 'player-1' })
		expect(skip.state.pendingDiscard?.reason).toBe('skip')
		state = applyGameAction(skip.state, {
			type: 'SELECT_DISCARD',
			playerId: 'player-1',
			cardInstanceId: skip.state.players[0].hand[0].instanceId,
		}).state
		const done = applyGameAction(state, { type: 'CONFIRM_DISCARD', playerId: 'player-1' })
		expect(done.ok).toBe(true)
		expect(done.state.players[0].hand).toHaveLength(5)
		expect(done.state.turn.currentPlayerId).toBe('player-2')
	})

	it('recycles the Draw pile and rotates Monsters when four or more remain', () => {
		const state = createSandboxScenario('draw-deck-recycle').state
		const before = state.faceUpMonsterIds
		const result = applyGameAction(state, { type: 'SKIP_TURN', playerId: 'player-1' })
		expect(result.ok).toBe(true)
		expect(result.state.discardPile).toHaveLength(0)
		expect(result.state.faceUpMonsterIds).not.toEqual(before)
		expect(result.state.events.some((event) => event.type === 'monsters-rotated')).toBe(true)
	})

	it('does not rotate the final three during recycling', () => {
		const state = createSandboxScenario('final-three').state
		state.discardPile = [...state.drawPile]
		state.drawPile = []
		const before = [...state.faceUpMonsterIds]
		const result = applyGameAction(state, { type: 'SKIP_TURN', playerId: 'player-1' })
		expect(result.ok).toBe(true)
		expect(result.state.faceUpMonsterIds).toEqual(before)
	})

	it('shrinks the final-three board without replacement', () => {
		const state = createSandboxScenario('final-three').state
		state.turn.currentPlayerId = 'player-1'
		const monsterId = state.faceUpMonsterIds[0]
		ensureDefinitionsInHand(
			state,
			'player-1',
			CORE_CATALOG.regularMonsters[monsterId].requiredWeapons,
		)
		const result = applyGameAction(state, {
			type: 'DEFEAT_MONSTER',
			playerId: 'player-1',
			monsterId,
		})
		expect(result.ok).toBe(true)
		expect(result.state.faceUpMonsterIds).toHaveLength(2)
		expect(result.state.monsterDeck).toHaveLength(0)
	})
})

describe('scoring and Sudden Death', () => {
	it('derives a 12–12 tie from defeated Monsters', () => {
		const state = createSandboxScenario('score-tie').state
		expect(getPlayerScore(state, 'player-1', CORE_CATALOG)).toBe(12)
		expect(getPlayerScore(state, 'player-2', CORE_CATALOG)).toBe(12)
	})

	it('starts Sudden Death after the final Monster creates a tie', () => {
		const state = createSandboxScenario('score-tie').state
		const finalMonster = state.players[1].defeatedMonsterIds.find(
			(id) => CORE_CATALOG.regularMonsters[id].points === 1,
		)!
		state.players[1].defeatedMonsterIds = state.players[1].defeatedMonsterIds.filter(
			(id) => id !== finalMonster,
		)
		state.faceUpMonsterIds = [finalMonster]
		state.turn.currentPlayerId = 'player-2'
		const requirements = CORE_CATALOG.regularMonsters[finalMonster].requiredWeapons
		ensureDefinitionsInHand(state, 'player-2', requirements)
		const result = applyGameAction(state, {
			type: 'DEFEAT_MONSTER',
			playerId: 'player-2',
			monsterId: finalMonster,
		})
		expect(result.ok).toBe(true)
		expect(result.state.mode).toBe('sudden-death')
		expect(result.state.activeSuddenDeathMonsterId).toBe('the-infinity-beast')
		expect(allCards(result.state).filter((card) => card.definitionId === 'black-hole')).toHaveLength(1)
		expect(result.state.removedPlayerCards.some((card) => card.definitionId === 'black-hole')).toBe(true)
	})

	it('ends immediately when The Infinity Beast requirement is met', () => {
		const state = createSandboxScenario('infinity-beast-beatable').state
		const result = applyGameAction(state, {
			type: 'DEFEAT_MONSTER',
			playerId: 'player-1',
			monsterId: 'the-infinity-beast',
		})
		expect(result.ok).toBe(true)
		expect(result.state.phase).toBe('game-over')
		expect(result.state.winnerId).toBe('player-1')
		expect(getPlayerScore(result.state, 'player-1', CORE_CATALOG)).toBe(12)
	})

	it('requires all four Infinity Beast Weapons, including Spear', () => {
		const state = createSandboxScenario('infinity-beast-beatable').state
		const player = state.players.find((candidate) => candidate.id === 'player-1')!
		player.hand = player.hand.filter((card) => card.definitionId !== 'spear')

		expect(CORE_CATALOG.suddenDeathMonster.requiredWeapons).toEqual([
			'gun',
			'spear',
			'grenade',
			'sword',
		])
		expect(
			canDefeatMonster(state, 'player-1', 'the-infinity-beast', CORE_CATALOG),
		).toBe(false)
	})
})

describe('validation, expansions, and persistence', () => {
	for (const preset of SANDBOX_PRESETS) {
		it(`${preset} produces a valid state`, () => {
			const scenario = createSandboxScenario(preset)
			expect(validateGameState(scenario.state, scenario.catalog).errors).toEqual([])
		})
	}

	it('detects duplicate and missing card instances', () => {
		const state = newGame()
		state.drawPile.push(state.players[0].hand[0])
		const result = validateGameState(state)
		expect(result.valid).toBe(false)
		expect(result.errors.join(' ')).toMatch(/multiple zones|Expected 24/)
	})

	it('accepts a synthetic Action identity without changing the turn engine', () => {
		const syntheticCards: Record<string, PlayerCardDefinition> = { ...CORE_CATALOG.playerCards }
		delete syntheticCards['draw-1']
		syntheticCards['scout-1'] = {
			id: 'scout-1',
			name: 'Scout 1',
			category: 'action',
			copies: 3,
			assetPath: '/synthetic.png',
			rulesText: 'Draw one.',
			effect: { type: 'draw', count: 1 },
		}
		const catalog: GameCatalog = { ...CORE_CATALOG, id: 'synthetic-action', playerCards: syntheticCards }
		const state = createGame(
			{
				seed: 12,
				startingPlayerId: 'p1',
				players: [
					{ id: 'p1', name: 'P1', controller: 'human-local' },
					{ id: 'p2', name: 'P2', controller: 'computer' },
				],
			},
			catalog,
		)
		swapDefinitionIntoHand(state, 'p1', 'scout-1')
		const action = state.players[0].hand.find((card) => card.definitionId === 'scout-1')!
		expect(
			applyGameAction(
				state,
				{ type: 'PLAY_ACTION_CARD', playerId: 'p1', cardInstanceId: action.instanceId },
				catalog,
			).ok,
		).toBe(true)
	})

	it('registers a new Take 1 effect without changing the turn engine', () => {
		const playerCards: Record<string, PlayerCardDefinition> = { ...CORE_CATALOG.playerCards }
		delete playerCards['draw-1']
		playerCards['take-1'] = {
			id: 'take-1',
			name: 'Take 1',
			category: 'action',
			copies: 3,
			assetPath: '/synthetic.png',
			rulesText: 'Take one card from the opponent.',
			effect: { type: 'take-from-opponent', count: 1 },
		}
		const catalog: GameCatalog = { ...CORE_CATALOG, id: 'take-action', playerCards }
		const actionEffects: ActionEffectRegistry = {
			...CORE_ACTION_EFFECTS,
			'take-from-opponent': ({ state, playerId, effect }) => {
				const player = state.players.find((candidate) => candidate.id === playerId)!
				const opponent = state.players.find((candidate) => candidate.id !== playerId)!
				const count = typeof effect.count === 'number' ? effect.count : 0
				player.hand.push(...opponent.hand.splice(0, count))
			},
		}
		const state = createGame(
			{
				seed: 5,
				startingPlayerId: 'p1',
				players: [
					{ id: 'p1', name: 'P1', controller: 'human-local' },
					{ id: 'p2', name: 'P2', controller: 'human-remote' },
				],
			},
			catalog,
		)
		swapDefinitionIntoHand(state, 'p1', 'take-1')
		const beforeOpponentCount = state.players[1].hand.length
		const action = state.players[0].hand.find((card) => card.definitionId === 'take-1')!
		const result = applyGameAction(
			state,
			{ type: 'PLAY_ACTION_CARD', playerId: 'p1', cardInstanceId: action.instanceId },
			catalog,
			actionEffects,
		)
		expect(result.ok).toBe(true)
		expect(result.state.players[1].hand).toHaveLength(beforeOpponentCount - 1)
		expect(validateGameState(result.state, catalog, actionEffects).valid).toBe(true)
		expect(validateGameState(state, catalog).errors.join(' ')).toContain('Unknown Action effect')
	})

	it('accepts a different legal Monster point distribution', () => {
		const scenario = createSandboxScenario('alternate-monster-distribution')
		expect(Object.values(scenario.catalog.regularMonsters).filter((monster) => monster.points === 2)).toHaveLength(9)
		expect(validateGameState(scenario.state, scenario.catalog).valid).toBe(true)
	})

	it('uses alternate Monster definitions for lifecycle, scoring, and victory', () => {
		const scenario = createSandboxScenario('alternate-monster-distribution')
		const { state, catalog } = scenario
		const finalMonster = state.faceUpMonsterIds[0]
		const winner = state.players[0]
		const otherFaceUp = state.faceUpMonsterIds[1]
		winner.defeatedMonsterIds = Object.keys(catalog.regularMonsters).filter(
			(id) => id !== finalMonster,
		)
		state.players[1].defeatedMonsterIds = []
		state.faceUpMonsterIds = [finalMonster]
		state.monsterDeck = []
		state.turn.currentPlayerId = winner.id
		ensureDefinitionsInHand(
			state,
			winner.id,
			catalog.regularMonsters[finalMonster].requiredWeapons,
		)
		expect(otherFaceUp).toBeTruthy()
		const scoreBefore = getPlayerScore(state, winner.id, catalog)
		const result = applyGameAction(
			state,
			{ type: 'DEFEAT_MONSTER', playerId: winner.id, monsterId: finalMonster },
			catalog,
		)
		expect(result.ok).toBe(true)
		expect(result.state.phase).toBe('game-over')
		expect(result.state.winnerId).toBe(winner.id)
		expect(getPlayerScore(result.state, winner.id, catalog)).toBe(
			scoreBefore + Number(catalog.regularMonsters[finalMonster].points),
		)
	})

	it('round-trips valid JSON state and rejects corrupted storage', () => {
		const state = newGame()
		expect(restoreGame(serializeGame(state))).toEqual(state)
		expect(restoreGame('{"version":999}')).toBeNull()
	})

	it('does not offer completed matches as resumable games', () => {
		const active = newGame()
		expect(isResumableGame(active)).toBe(true)
		const complete = createSandboxScenario('infinity-beast-beatable').state
		complete.phase = 'game-over'
		complete.winnerId = 'player-1'
		expect(isResumableGame(complete)).toBe(false)
	})
})

describe('complete-match simulation', () => {
	it('completes a seeded match using only normal actions', () => {
		let state = createGame({
			seed: 20260912,
			startingPlayerId: 'bot-1',
			players: [
				{ id: 'bot-1', name: 'Bot One', controller: 'computer' },
				{ id: 'bot-2', name: 'Bot Two', controller: 'computer' },
			],
		})
		let turns = 0
		while (state.phase !== 'game-over' && turns < 500) {
			const playerId = state.pendingDiscard?.playerId ?? state.turn.currentPlayerId
			const result = runComputerTurn(state, playerId)
			expect(result.ok, result.error).toBe(true)
			expect(result.actions.length).toBeGreaterThan(0)
			state = result.state
			expect(validateGameState(state).errors).toEqual([])
			turns += 1
		}
		expect(state.phase).toBe('game-over')
		expect(state.winnerId).toBeTruthy()
	})
})
