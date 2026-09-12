import { CORE_CATALOG } from '../definitions/core'
import type { GameCatalog, PlayerCardInstance } from '../definitions/types'
import { buildPlayerCardInstances, createGame } from '../engine/createGame'
import type { GameState } from '../engine/types'

export const SANDBOX_PRESETS = [
	'fresh-game',
	'draw-2-over-limit',
	'action-chain',
	'action-timing-lock',
	'beatable-monster',
	'unbeatable-monster',
	'black-hole-ready',
	'draw-deck-recycle',
	'final-three',
	'score-tie',
	'sudden-death',
	'infinity-beast-beatable',
	'alternate-monster-distribution',
] as const

export type SandboxPreset = (typeof SANDBOX_PRESETS)[number]

export interface SandboxScenario {
	state: GameState
	catalog: GameCatalog
	description: string
}

function fresh(catalog: GameCatalog = CORE_CATALOG): GameState {
	return createGame(
		{
			seed: 8675309,
			startingPlayerId: 'player-1',
			players: [
				{ id: 'player-1', name: 'Player', controller: 'human-local' },
				{ id: 'player-2', name: 'Computer', controller: 'computer' },
			],
		},
		catalog,
	)
}

interface CardLayout {
	playerOne: string[]
	playerTwo?: string[]
	drawTop?: string[]
	leftovers?: 'draw' | 'discard'
}

function arrangeCards(state: GameState, catalog: GameCatalog, layout: CardLayout): void {
	const pool = new Map<string, PlayerCardInstance[]>()
	for (const card of buildPlayerCardInstances(catalog)) {
		const cards = pool.get(card.definitionId) ?? []
		cards.push(card)
		pool.set(card.definitionId, cards)
	}
	const take = (definitionIds: string[]) =>
		definitionIds.map((definitionId) => {
			const card = pool.get(definitionId)?.shift()
			if (!card) {
				throw new Error(`Sandbox requested unavailable card: ${definitionId}`)
			}
			return card
		})
	state.players[0].hand = take(layout.playerOne)
	state.players[1].hand = take(layout.playerTwo ?? ['bow', 'grenade', 'mace'])
	const drawTop = take(layout.drawTop ?? [])
	const leftovers = [...pool.values()].flat()
	state.drawPile = layout.leftovers === 'discard' ? [] : [...drawTop, ...leftovers]
	state.discardPile = layout.leftovers === 'discard' ? [...drawTop, ...leftovers] : []
	state.removedPlayerCards = []
}

function arrangeMonsters(
	state: GameState,
	faceUp: string[],
	defeatedByOne: string[] = [],
	defeatedByTwo: string[] = [],
): void {
	const used = new Set([...faceUp, ...defeatedByOne, ...defeatedByTwo])
	state.faceUpMonsterIds = [...faceUp]
	state.players[0].defeatedMonsterIds = [...defeatedByOne]
	state.players[1].defeatedMonsterIds = [...defeatedByTwo]
	state.monsterDeck = Object.keys(CORE_CATALOG.regularMonsters).filter((id) => !used.has(id))
}

function tieState(): GameState {
	const state = fresh()
	const playerOneMonsters = [
		'thing',
		'pincher',
		'rock-crab',
		'ground-worm',
		'spikey',
		'socket',
	]
	const playerTwoMonsters = Object.keys(CORE_CATALOG.regularMonsters).filter(
		(id) => !playerOneMonsters.includes(id),
	)
	arrangeMonsters(state, [], playerOneMonsters, playerTwoMonsters)
	return state
}

function suddenDeathState(beatable: boolean): GameState {
	const state = tieState()
	arrangeCards(state, CORE_CATALOG, {
		playerOne: beatable
			? ['grenade', 'sword', 'gun', 'draw-1']
			: ['bow', 'bow', 'mace', 'draw-1'],
		playerTwo: ['grenade', 'sword', 'gun', 'draw-2'],
	})
	const ultimateLocations = [state.drawPile, state.discardPile, ...state.players.map((player) => player.hand)]
	for (const zone of ultimateLocations) {
		const ultimateIndex = zone.findIndex((card) => card.definitionId === 'black-hole')
		if (ultimateIndex >= 0) {
			state.removedPlayerCards.push(...zone.splice(ultimateIndex, 1))
			break
		}
	}
	state.mode = 'sudden-death'
	state.phase = 'action'
	state.activeSuddenDeathMonsterId = CORE_CATALOG.suddenDeathMonster.id
	state.pendingDiscard = null
	state.turn.actionPhaseOpen = true
	return state
}

function alternateCatalog(): GameCatalog {
	return {
		...CORE_CATALOG,
		id: 'alternate-monster-points',
		regularMonsters: Object.fromEntries(
			Object.values(CORE_CATALOG.regularMonsters).map((monster, index) => [
				monster.id,
				{ ...monster, points: index % 2 === 0 ? 2 : 1 },
			]),
		),
	}
}

export function createSandboxScenario(preset: SandboxPreset): SandboxScenario {
	if (preset === 'alternate-monster-distribution') {
		const catalog = alternateCatalog()
		return {
			state: fresh(catalog),
			catalog,
			description: 'A legal 17-Monster set with a non-core point distribution.',
		}
	}
	if (preset === 'score-tie') {
		return { state: tieState(), catalog: CORE_CATALOG, description: 'All regular Monsters split into a 12–12 tie.' }
	}
	if (preset === 'sudden-death' || preset === 'infinity-beast-beatable') {
		return {
			state: suddenDeathState(preset === 'infinity-beast-beatable'),
			catalog: CORE_CATALOG,
			description:
				preset === 'sudden-death'
					? 'A valid Sudden Death turn with Ultimate Weapons removed.'
					: 'The active player can defeat The Infinity Beast.',
		}
	}

	const state = fresh()
	let description = 'A deterministic fresh Solo game.'
	switch (preset) {
		case 'fresh-game':
			break
		case 'draw-2-over-limit':
			arrangeCards(state, CORE_CATALOG, {
				playerOne: ['draw-2', 'bow', 'grenade', 'mace', 'sword'],
				drawTop: ['spear', 'gun'],
			})
			description = 'Playing Draw 2 resolves both cards before requiring one discard.'
			break
		case 'action-chain':
			arrangeCards(state, CORE_CATALOG, {
				playerOne: ['draw-2', 'bow', 'grenade'],
				drawTop: ['draw-1', 'sword'],
			})
			description = 'Draw 2 places a newly playable Draw 1 into the hand.'
			break
		case 'action-timing-lock':
			arrangeCards(state, CORE_CATALOG, {
				playerOne: ['draw-1', 'gun', 'spear'],
			})
			arrangeMonsters(state, ['socket', 'top'])
			description = 'An Action and a beatable Monster demonstrate that a defeat ends Action timing.'
			break
		case 'beatable-monster':
			arrangeCards(state, CORE_CATALOG, { playerOne: ['grenade', 'gun', 'mace'] })
			arrangeMonsters(state, ['ground-worm', 'top'])
			description = 'Ground Worm is beatable with Grenade, Gun, and Mace.'
			break
		case 'unbeatable-monster':
			arrangeCards(state, CORE_CATALOG, { playerOne: ['bow', 'bow', 'mace'] })
			arrangeMonsters(state, ['thing', 'top'])
			description = 'Thing is intentionally missing required Weapons.'
			break
		case 'black-hole-ready':
			arrangeCards(state, CORE_CATALOG, { playerOne: ['black-hole', 'bow', 'mace'] })
			arrangeMonsters(state, ['thing', 'kraken'])
			description = 'Black Hole can defeat either regular Monster without spending Weapons.'
			break
		case 'draw-deck-recycle':
			arrangeCards(state, CORE_CATALOG, {
				playerOne: ['bow', 'grenade', 'mace'],
				leftovers: 'discard',
			})
			description = 'The next draw recycles the discard and rotates Monsters.'
			break
		case 'final-three': {
			const remaining = ['thing', 'kraken', 'socket']
			const defeated = Object.keys(CORE_CATALOG.regularMonsters).filter(
				(id) => !remaining.includes(id),
			)
			arrangeMonsters(state, remaining, defeated.slice(0, 7), defeated.slice(7))
			description = 'Exactly three undefeated Monsters are face-up; the board will shrink 3 → 2 → 1 → 0.'
			break
		}
		default:
			break
	}
	return { state, catalog: CORE_CATALOG, description }
}
