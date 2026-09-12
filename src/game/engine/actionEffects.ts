import type { ActionEffect, PlayerId } from '../definitions/types'
import type { GameState } from './types'

export interface ActionEffectContext {
	state: GameState
	playerId: PlayerId
	effect: ActionEffect
	drawCards: (count: number) => number
}

export type ActionEffectHandler = (context: ActionEffectContext) => void
export type ActionEffectRegistry = Record<string, ActionEffectHandler>

export const CORE_ACTION_EFFECTS: ActionEffectRegistry = {
	draw: ({ effect, drawCards }) => {
		const count = effect.count
		if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
			throw new Error('Draw effects require a non-negative integer count.')
		}
		drawCards(count)
	},
}
