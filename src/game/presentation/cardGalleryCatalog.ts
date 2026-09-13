import type { GameCatalog, MonsterDefinition, PlayerCardDefinition } from '../definitions/types'

export type GalleryCategory = 'all' | 'monsters' | 'weapons' | 'actions'

export interface CardGalleryEntry {
	id: string
	name: string
	category: Exclude<GalleryCategory, 'all'>
	categoryLabel: string
	assetPath: string
	description: string
	meta: string
}

function monsterEntry(monster: MonsterDefinition): CardGalleryEntry {
	const points = monster.points === 'infinity' ? 'Instant victory' : `${monster.points} point${monster.points === 1 ? '' : 's'}`
	return {
		id: `monster-${monster.id}`,
		name: monster.name,
		category: 'monsters',
		categoryLabel: monster.isSuddenDeath ? 'Sudden Death Monster' : 'Monster',
		assetPath: monster.assetPath,
		description: monster.lore,
		meta: `${points} · Requires ${monster.requiredWeapons.join(', ')}`,
	}
}

function playerCardEntry(card: PlayerCardDefinition): CardGalleryEntry {
	const isAction = card.category === 'action'
	return {
		id: `player-${card.id}`,
		name: card.name,
		category: isAction ? 'actions' : 'weapons',
		categoryLabel: card.category === 'ultimate-weapon' ? 'Ultimate Weapon' : isAction ? 'Action' : 'Weapon',
		assetPath: card.assetPath,
		description: card.rulesText,
		meta: `${card.copies} cop${card.copies === 1 ? 'y' : 'ies'} in the core deck`,
	}
}

export function getCardGalleryEntries(catalog: GameCatalog): CardGalleryEntry[] {
	return [
		...Object.values(catalog.regularMonsters).map(monsterEntry),
		monsterEntry(catalog.suddenDeathMonster),
		...Object.values(catalog.playerCards).map(playerCardEntry),
	]
}

export function filterCardGalleryEntries(
	entries: CardGalleryEntry[],
	category: GalleryCategory,
): CardGalleryEntry[] {
	return category === 'all' ? entries : entries.filter((entry) => entry.category === category)
}
