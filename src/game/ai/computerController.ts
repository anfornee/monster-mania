import { CORE_CATALOG } from '../definitions/core'
import type { GameCatalog, PlayerId } from '../definitions/types'
import { applyGameAction } from '../engine/applyGameAction'
import type { GameAction, GameState } from '../engine/types'
import { getPlayer } from '../selectors/gameSelectors'
import {
	chooseComputerAction,
	heuristicComputerStrategy,
	type ComputerStrategy,
} from './computerStrategy'

export interface RunComputerTurnOptions {
	strategy?: ComputerStrategy
	maxActions?: number
}

export interface ComputerTurnResult {
	ok: boolean
	state: GameState
	actions: GameAction[]
	error?: string
}

function getDecisionPlayerId(state: GameState): PlayerId | null {
	if (state.phase === 'forced-discard') {
		return state.pendingDiscard?.playerId ?? null
	}
	if (state.phase === 'action') {
		return state.turn.currentPlayerId
	}
	return null
}

/**
 * Resolves one computer player's complete turn through the public rules API.
 * It loops so Action draws and their forced discards are re-evaluated before
 * the computer decides whether to defeat a Monster or skip.
 */
export function runComputerTurn(
	state: GameState,
	playerId: PlayerId,
	catalog: GameCatalog = CORE_CATALOG,
	options: RunComputerTurnOptions = {},
): ComputerTurnResult {
	const strategy = options.strategy ?? heuristicComputerStrategy
	const maxActions = options.maxActions ?? 50
	if (
		getDecisionPlayerId(state) !== playerId ||
		getPlayer(state, playerId)?.controller !== 'computer'
	) {
		return { ok: true, state, actions: [] }
	}

	let currentState = state
	const actions: GameAction[] = []
	for (let actionCount = 0; actionCount < maxActions; actionCount += 1) {
		const decisionPlayerId = getDecisionPlayerId(currentState)
		if (decisionPlayerId !== playerId) {
			return { ok: true, state: currentState, actions }
		}
		const action = chooseComputerAction(
			currentState,
			playerId,
			catalog,
			strategy,
		)
		if (!action) {
			return { ok: true, state: currentState, actions }
		}
		const result = applyGameAction(currentState, action, catalog)
		if (!result.ok) {
			return { ok: false, state: currentState, actions, error: result.error }
		}
		actions.push(action)
		currentState = result.state
		if (getDecisionPlayerId(currentState) !== playerId) {
			return { ok: true, state: currentState, actions }
		}
	}

	return {
		ok: false,
		state: currentState,
		actions,
		error: `Computer turn exceeded the ${maxActions}-action safety limit.`,
	}
}
