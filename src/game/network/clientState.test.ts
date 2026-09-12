import { describe, expect, it } from 'vitest'
import { createGame } from '../engine/createGame'
import {
	createClientGameState,
	serializeClientGameState,
} from './clientState'

describe('client game-state filtering', () => {
	it('serializes only the viewing player hand and public zone counts', () => {
		const state = createGame({
			seed: 47,
			players: [
				{ id: 'one', name: 'One', controller: 'human-remote' },
				{ id: 'two', name: 'Two', controller: 'human-remote' },
			],
		})
		const opponentCardIds = state.players[1].hand.map((card) => card.instanceId)
		const serialized = serializeClientGameState(state, 'one')
		const clientState = createClientGameState(state, 'one')

		for (const instanceId of opponentCardIds) {
			expect(serialized).not.toContain(instanceId)
		}
		expect(clientState.myHand).toEqual(state.players[0].hand)
		expect(clientState.publicState.players[1].handCount).toBe(3)
		expect(clientState.publicState.drawPileCount).toBe(state.drawPile.length)
		expect(serialized).not.toContain('"drawPile":')
		expect(serialized).not.toContain('"rngState":')
	})

	it('rejects attempts to create a view for a non-member', () => {
		const state = createGame({
			seed: 47,
			players: [
				{ id: 'one', name: 'One', controller: 'human-remote' },
				{ id: 'two', name: 'Two', controller: 'human-remote' },
			],
		})

		expect(() => createClientGameState(state, 'intruder')).toThrow(
			'Cannot create client state for a player outside the game.',
		)
	})
})
