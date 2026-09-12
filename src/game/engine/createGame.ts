import { CORE_CATALOG } from '../definitions/core'
import type { GameCatalog, PlayerCardInstance } from '../definitions/types'
import { nextRandom, shuffleWithSeed } from './random'
import type { CreateGameOptions, GameState, PlayerState } from './types'

export function buildPlayerCardInstances(catalog: GameCatalog): PlayerCardInstance[] {
	return Object.values(catalog.playerCards).flatMap((definition) =>
		Array.from({ length: definition.copies }, (_, index) => ({
			instanceId: `${definition.id}-${index + 1}`,
			definitionId: definition.id,
		})),
	)
}

export function createGame(
	options: CreateGameOptions,
	catalog: GameCatalog = CORE_CATALOG,
): GameState {
	const categoryCounts = Object.values(catalog.playerCards).reduce(
		(counts, definition) => {
			counts[definition.category] += definition.copies
			return counts
		},
		{ weapon: 0, action: 0, 'ultimate-weapon': 0 },
	)
	if (
		categoryCounts.weapon !== 18 ||
		categoryCounts.action !== 5 ||
		categoryCounts['ultimate-weapon'] !== 1
	) {
		throw new Error('A standard catalog requires 18 Weapons, 5 Actions, and 1 Ultimate Weapon.')
	}
	if (Object.keys(catalog.regularMonsters).length !== 17) {
		throw new Error('A standard catalog requires exactly 17 regular Monsters.')
	}
	if (options.players.length !== 2) {
		throw new Error('Monster Mania requires exactly two participants.')
	}
	if (new Set(options.players.map((player) => player.id)).size !== 2) {
		throw new Error('Participant IDs must be unique.')
	}

	const initialSeed = options.seed ?? Date.now()
	const shuffledCards = shuffleWithSeed(buildPlayerCardInstances(catalog), initialSeed)
	const shuffledMonsters = shuffleWithSeed(
		Object.keys(catalog.regularMonsters),
		shuffledCards.seed,
	)
	const drawPile = [...shuffledCards.values]
	const players: PlayerState[] = options.players.map((player) => ({
		...player,
		hand: drawPile.splice(0, 3),
		defeatedMonsterIds: [],
	}))
	const startingRoll = nextRandom(shuffledMonsters.seed)
	const randomStartingPlayer = players[Math.floor(startingRoll.value * players.length)]
	const requestedStartingPlayer = players.find(
		(player) => player.id === options.startingPlayerId,
	)
	const startingPlayer = requestedStartingPlayer ?? randomStartingPlayer

	return {
		schemaVersion: 1,
		rulesetId: catalog.id,
		players,
		mode: 'regular',
		phase: 'action',
		turn: {
			number: 1,
			currentPlayerId: startingPlayer.id,
			actionPhaseOpen: true,
			monsterDefeated: false,
		},
		drawPile,
		discardPile: [],
		removedPlayerCards: [],
		monsterDeck: shuffledMonsters.values.slice(2),
		faceUpMonsterIds: shuffledMonsters.values.slice(0, 2),
		activeSuddenDeathMonsterId: null,
		pendingDiscard: null,
		winnerId: null,
		events: [
			{
				id: 1,
				type: 'game-started',
				message: `${startingPlayer.name} takes the first turn.`,
			},
		],
		nextEventId: 2,
		rngState: startingRoll.seed,
	}
}
