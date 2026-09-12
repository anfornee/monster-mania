import type {
	GameCatalog,
	MonsterDefinition,
	PlayerCardDefinition,
} from './types'
import { versionAssetPath } from '../assets/assetVersion'

const asset = (path: string) => versionAssetPath(`/assets/cards/${path}`)

export const CORE_PLAYER_CARDS = [
	...(['bow', 'grenade', 'mace', 'sword', 'spear', 'gun'] as const).map(
		(weaponId): PlayerCardDefinition => ({
			id: weaponId,
			name: weaponId === 'gun' ? 'Gun / Rifle' : `${weaponId[0].toUpperCase()}${weaponId.slice(1)}`,
			category: 'weapon',
			weaponId,
			copies: 3,
			assetPath: asset(`weapons/${weaponId}-card.jpg`),
			rulesText: 'Use this Weapon as part of a Monster requirement.',
		}),
	),
	{
		id: 'draw-1',
		name: 'Draw 1',
		category: 'action',
		copies: 3,
		assetPath: asset('actions/draw-1-card.jpg'),
		rulesText: 'Draw 1 card. Then discard down to your hand limit.',
		effect: { type: 'draw', count: 1 },
	},
	{
		id: 'draw-2',
		name: 'Draw 2',
		category: 'action',
		copies: 2,
		assetPath: asset('actions/draw-2-card.jpg'),
		rulesText: 'Draw 2 cards. Then discard down to your hand limit.',
		effect: { type: 'draw', count: 2 },
	},
	{
		id: 'black-hole',
		name: 'Black Hole',
		category: 'ultimate-weapon',
		copies: 1,
		assetPath: asset('weapons/black-hole-card.jpg'),
		rulesText: 'Defeat one regular Monster without spending its required Weapons.',
		effect: { type: 'defeat-regular-monster' },
	},
] satisfies PlayerCardDefinition[]

const monster = (
	id: string,
	name: string,
	points: number,
	requiredWeapons: string[],
): MonsterDefinition => ({
	id,
	name,
	points,
	requiredWeapons,
	assetPath: asset(`monsters/${id}-card.jpg`),
	lore: `${name} is one of Monster Mania's unpredictable arena creatures.`,
})

export const CORE_REGULAR_MONSTERS = [
	monster('socket', 'Socket', 1, ['gun', 'spear']),
	monster('top', 'Top', 1, ['grenade', 'sword']),
	monster('bitty-bitey', 'Bitty Bitey', 1, ['mace', 'spear']),
	monster('flower-trap', 'Flower Trap', 1, ['mace', 'bow']),
	monster('smasher', 'Smasher', 1, ['bow', 'mace']),
	monster('wrecking-snake', 'Wrecking Snake', 1, ['spear', 'sword']),
	monster('boom-boom', 'Boom Boom', 1, ['spear', 'gun']),
	monster('rocket-chomper', 'Rocket Chomper', 1, ['grenade', 'spear']),
	monster('wacker', 'Wacker', 1, ['mace', 'sword']),
	monster('chomper', 'Chomper', 1, ['grenade', 'sword']),
	monster('slice-and-dice', 'Slice and Dice', 1, ['sword', 'spear']),
	monster('pincher', 'Pincher', 2, ['grenade', 'spear', 'sword']),
	monster('rock-crab', 'Rock Crab', 2, ['grenade', 'gun', 'bow']),
	monster('ground-worm', 'Ground Worm', 2, ['grenade', 'gun', 'mace']),
	monster('spikey', 'Spikey', 2, ['bow', 'sword', 'spear']),
	monster('kraken', 'Kraken', 2, ['bow', 'gun', 'grenade']),
	monster('thing', 'Thing', 3, ['gun', 'spear', 'grenade', 'bow']),
] satisfies MonsterDefinition[]

export const INFINITY_BEAST: MonsterDefinition = {
	id: 'the-infinity-beast',
	name: 'The Infinity Beast',
	points: 'infinity',
	requiredWeapons: ['grenade', 'sword', 'gun'],
	assetPath: asset('monsters/the-infinity-beast-card.jpg'),
	lore: 'A creature beyond points. Defeating it ends Sudden Death immediately.',
	isSuddenDeath: true,
}

export const CORE_CATALOG: GameCatalog = {
	id: 'core-v1',
	playerCards: Object.fromEntries(CORE_PLAYER_CARDS.map((card) => [card.id, card])),
	regularMonsters: Object.fromEntries(
		CORE_REGULAR_MONSTERS.map((monsterDefinition) => [
			monsterDefinition.id,
			monsterDefinition,
		]),
	),
	suddenDeathMonster: INFINITY_BEAST,
}
