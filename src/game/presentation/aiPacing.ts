import type { GameAction, GameState } from '../engine/types'

export const GAME_TIMING = {
	aiThink: 700,
	aiBetweenActions: 430,
	aiHandoff: 260,
	announcement: 2300,
} as const

export function getComputerActionDelay(state: GameState, isFirstAction: boolean): number {
	if (isFirstAction) return GAME_TIMING.aiThink
	return state.phase === 'forced-discard'
		? GAME_TIMING.aiBetweenActions - 100
		: GAME_TIMING.aiBetweenActions
}

export function describeComputerAction(action: GameAction): string {
	switch (action.type) {
		case 'PLAY_ACTION_CARD':
			return 'plays a card'
		case 'DEFEAT_MONSTER':
			return 'attacks a Monster'
		case 'USE_ULTIMATE_WEAPON':
			return 'unleashes an Ultimate Weapon'
		case 'SELECT_DISCARD':
			return 'chooses a discard'
		case 'CONFIRM_DISCARD':
			return 'discards a card'
		case 'SKIP_TURN':
			return 'ends the turn'
	}
}
