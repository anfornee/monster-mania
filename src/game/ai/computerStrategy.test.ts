import { describe, expect, it } from 'vitest'
import { CORE_CATALOG } from '../definitions/core'
import type { PlayerCardInstance } from '../definitions/types'
import { applyGameAction } from '../engine/applyGameAction'
import { createGame } from '../engine/createGame'
import type { GameState } from '../engine/types'
import { chooseComputerAction, runComputerTurn } from './index'

const humanId = 'human'
const computerId = 'computer'

function card(definitionId: string, suffix = 'test'): PlayerCardInstance {
	return { instanceId: `${definitionId}-${suffix}`, definitionId }
}

function gameWithComputerTurn(): GameState {
	return createGame({
		seed: 123,
		startingPlayerId: computerId,
		players: [
			{ id: humanId, name: 'Human', controller: 'human-local' },
			{ id: computerId, name: 'CPU', controller: 'computer' },
		],
	})
}

function setComputerHand(state: GameState, hand: PlayerCardInstance[]): void {
	state.players.find((player) => player.id === computerId)!.hand = hand
}

describe('heuristicComputerStrategy', () => {
	it('plays and re-evaluates chained draw Actions through the rules engine', () => {
		const state = gameWithComputerTurn()
		setComputerHand(state, [card('draw-1', 'hand')])
		state.drawPile = [
			card('draw-2', 'drawn'),
			card('bow', 'drawn'),
			card('mace', 'drawn'),
		]
		state.discardPile = []
		state.faceUpMonsterIds = ['thing']

		const result = runComputerTurn(state, computerId)

		expect(result.ok).toBe(true)
		expect(result.actions.map((action) => action.type)).toEqual([
			'PLAY_ACTION_CARD',
			'PLAY_ACTION_CARD',
			'SKIP_TURN',
		])
		expect(result.state.turn.currentPlayerId).toBe(humanId)
	})

	it('normally defeats the highest-point beatable Monster with a stable tie break', () => {
		const state = gameWithComputerTurn()
		setComputerHand(state, [
			card('grenade'),
			card('gun'),
			card('bow'),
			card('spear'),
			card('black-hole'),
		])
		state.drawPile = []
		state.discardPile = []
		state.faceUpMonsterIds = ['socket', 'rock-crab', 'kraken']

		const action = chooseComputerAction(state, computerId)

		expect(action).toEqual({
			type: 'DEFEAT_MONSTER',
			playerId: computerId,
			monsterId: 'rock-crab',
		})
		expect(applyGameAction(state, action!, CORE_CATALOG).ok).toBe(true)
	})

	it('saves the Ultimate Weapon when a normal defeat is available', () => {
		const state = gameWithComputerTurn()
		setComputerHand(state, [card('gun'), card('spear'), card('black-hole')])
		state.drawPile = []
		state.discardPile = []
		state.faceUpMonsterIds = ['socket']

		expect(chooseComputerAction(state, computerId)?.type).toBe('DEFEAT_MONSTER')
	})

	it('uses the Ultimate Weapon on the highest-point regular Monster otherwise', () => {
		const state = gameWithComputerTurn()
		setComputerHand(state, [card('black-hole')])
		state.drawPile = []
		state.discardPile = []
		state.faceUpMonsterIds = ['socket', 'thing']

		expect(chooseComputerAction(state, computerId)).toEqual({
			type: 'USE_ULTIMATE_WEAPON',
			playerId: computerId,
			cardInstanceId: 'black-hole-test',
			monsterId: 'thing',
		})
	})

	it('selects and confirms forced discards deterministically', () => {
		const state = gameWithComputerTurn()
		setComputerHand(state, [card('black-hole'), card('draw-1'), card('bow')])
		state.phase = 'forced-discard'
		state.turn.actionPhaseOpen = false
		state.pendingDiscard = {
			playerId: computerId,
			requiredCount: 2,
			selectedCardInstanceIds: [],
			reason: 'action',
			remainingSetupPlayerIds: [],
		}

		const first = chooseComputerAction(state, computerId)
		expect(first).toMatchObject({
			type: 'SELECT_DISCARD',
			cardInstanceId: 'bow-test',
		})
		const afterFirst = applyGameAction(state, first!, CORE_CATALOG).state
		const second = chooseComputerAction(afterFirst, computerId)
		expect(second).toMatchObject({
			type: 'SELECT_DISCARD',
			cardInstanceId: 'draw-1-test',
		})
		const afterSecond = applyGameAction(afterFirst, second!, CORE_CATALOG).state
		expect(chooseComputerAction(afterSecond, computerId)?.type).toBe('CONFIRM_DISCARD')
	})

	it('preserves the Sudden Death four-Weapon kit during forced discard', () => {
		const state = gameWithComputerTurn()
		state.mode = 'sudden-death'
		state.activeSuddenDeathMonsterId = 'the-infinity-beast'
		setComputerHand(state, [
			card('gun'),
			card('spear'),
			card('grenade'),
			card('sword'),
			card('draw-1'),
		])
		state.phase = 'forced-discard'
		state.turn.actionPhaseOpen = false
		state.pendingDiscard = {
			playerId: computerId,
			requiredCount: 1,
			selectedCardInstanceIds: [],
			reason: 'action',
			remainingSetupPlayerIds: [],
		}

		expect(chooseComputerAction(state, computerId)).toMatchObject({
			type: 'SELECT_DISCARD',
			cardInstanceId: 'draw-1-test',
		})
	})

	it('recognizes the complete four-Weapon Sudden Death kit', () => {
		const state = gameWithComputerTurn()
		state.mode = 'sudden-death'
		state.activeSuddenDeathMonsterId = 'the-infinity-beast'
		setComputerHand(state, [card('gun'), card('spear'), card('grenade'), card('sword')])
		state.drawPile = []
		state.discardPile = []
		state.phase = 'action'
		state.turn.actionPhaseOpen = true

		expect(chooseComputerAction(state, computerId)).toEqual({
			type: 'DEFEAT_MONSTER',
			playerId: computerId,
			monsterId: 'the-infinity-beast',
		})
	})

	it('skips when it cannot draw or defeat a Monster', () => {
		const state = gameWithComputerTurn()
		setComputerHand(state, [card('bow')])
		state.drawPile = []
		state.discardPile = []
		state.faceUpMonsterIds = ['thing']

		expect(chooseComputerAction(state, computerId)).toEqual({
			type: 'SKIP_TURN',
			playerId: computerId,
		})
	})

	it('allows the controller strategy to be replaced', () => {
		const state = gameWithComputerTurn()
		const result = runComputerTurn(state, computerId, CORE_CATALOG, {
			strategy: ({ playerId }) => ({ type: 'SKIP_TURN', playerId }),
		})

		expect(result.ok).toBe(true)
		expect(result.actions).toEqual([{ type: 'SKIP_TURN', playerId: computerId }])
	})

	it('does not return actions for a human or mutate the input state', () => {
		const state = gameWithComputerTurn()
		setComputerHand(state, [card('black-hole')])
		state.drawPile = []
		state.discardPile = []
		state.faceUpMonsterIds = ['thing']
		const snapshot = structuredClone(state)

		const action = chooseComputerAction(state, computerId)
		const result = runComputerTurn(state, computerId)

		expect(action).not.toBeNull()
		expect(result.ok).toBe(true)
		expect(state).toEqual(snapshot)
		expect(chooseComputerAction(state, humanId)).toBeNull()
		expect(result.actions.every((candidate, index) => {
			let replayState = state
			for (let prior = 0; prior < index; prior += 1) {
				replayState = applyGameAction(replayState, result.actions[prior], CORE_CATALOG).state
			}
			return applyGameAction(replayState, candidate, CORE_CATALOG).ok
		})).toBe(true)
	})
})
