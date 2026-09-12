import type { GameCatalog, MonsterDefinition, PlayerCardInstance, PlayerId } from '../definitions/types'
import type { GameState, PlayerState } from '../engine/types'

export function getPlayer(state: GameState, playerId: PlayerId): PlayerState | undefined {
	return state.players.find((player) => player.id === playerId)
}

export function getCurrentPlayer(state: GameState): PlayerState {
	const player = getPlayer(state, state.turn.currentPlayerId)
	if (!player) {
		throw new Error(`Unknown current player: ${state.turn.currentPlayerId}`)
	}
	return player
}

export function getOpponent(state: GameState, playerId: PlayerId): PlayerState {
	const player = state.players.find((candidate) => candidate.id !== playerId)
	if (!player) {
		throw new Error(`No opponent exists for player: ${playerId}`)
	}
	return player
}

export function getHandLimit(state: GameState): number {
	return state.mode === 'sudden-death' ? 4 : 5
}

export function getPlayerScore(
	state: GameState,
	playerId: PlayerId,
	catalog: GameCatalog,
): number {
	const player = getPlayer(state, playerId)
	if (!player) {
		return 0
	}
	return player.defeatedMonsterIds.reduce((score, monsterId) => {
		const points = catalog.regularMonsters[monsterId]?.points
		return score + (typeof points === 'number' ? points : 0)
	}, 0)
}

export function getActiveMonsterDefinitions(
	state: GameState,
	catalog: GameCatalog,
): MonsterDefinition[] {
	if (state.mode === 'sudden-death' && state.activeSuddenDeathMonsterId) {
		return [catalog.suddenDeathMonster]
	}
	return state.faceUpMonsterIds.flatMap((id) => {
		const definition = catalog.regularMonsters[id]
		return definition ? [definition] : []
	})
}

export function getRequiredWeaponInstances(
	hand: PlayerCardInstance[],
	requiredWeapons: string[],
	catalog: GameCatalog,
): PlayerCardInstance[] | null {
	const available = [...hand]
	const selected: PlayerCardInstance[] = []
	for (const weaponId of requiredWeapons) {
		const index = available.findIndex((card) => {
			const definition = catalog.playerCards[card.definitionId]
			return definition?.category === 'weapon' && definition.weaponId === weaponId
		})
		if (index < 0) {
			return null
		}
		selected.push(available[index])
		available.splice(index, 1)
	}
	return selected
}

export function canDefeatMonster(
	state: GameState,
	playerId: PlayerId,
	monsterId: string,
	catalog: GameCatalog,
): boolean {
	if (
		state.phase !== 'action' ||
		state.turn.currentPlayerId !== playerId ||
		state.turn.monsterDefeated
	) {
		return false
	}
	const player = getPlayer(state, playerId)
	const isSuddenDeathTarget =
		state.mode === 'sudden-death' && state.activeSuddenDeathMonsterId === monsterId
	const definition = isSuddenDeathTarget
		? catalog.suddenDeathMonster
		: catalog.regularMonsters[monsterId]
	const isVisible = isSuddenDeathTarget || state.faceUpMonsterIds.includes(monsterId)
	return Boolean(
		player &&
			definition &&
			isVisible &&
			getRequiredWeaponInstances(player.hand, definition.requiredWeapons, catalog),
	)
}

export function canUseUltimateWeapon(
	state: GameState,
	playerId: PlayerId,
	cardInstanceId: string,
	monsterId: string,
	catalog: GameCatalog,
): boolean {
	if (
		state.mode !== 'regular' ||
		state.phase !== 'action' ||
		state.turn.currentPlayerId !== playerId ||
		!state.faceUpMonsterIds.includes(monsterId)
	) {
		return false
	}
	const player = getPlayer(state, playerId)
	const card = player?.hand.find((candidate) => candidate.instanceId === cardInstanceId)
	return catalog.playerCards[card?.definitionId ?? '']?.category === 'ultimate-weapon'
}
