import { CORE_CATALOG } from '../definitions/core'
import type { GameCatalog } from '../definitions/types'
import type { GameState } from '../engine/types'
import { validateGameState } from '../engine/validateGameState'

export const GAME_STORAGE_KEY = 'monster-mania:solo-game:v1'

export function serializeGame(state: GameState): string {
	return JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state })
}

export function restoreGame(
	serialized: string,
	catalog: GameCatalog = CORE_CATALOG,
): GameState | null {
	try {
		const stored = JSON.parse(serialized) as { version?: unknown; state?: GameState }
		if (stored.version !== 1 || !stored.state) {
			return null
		}
		return validateGameState(stored.state, catalog).valid ? stored.state : null
	} catch {
		return null
	}
}
