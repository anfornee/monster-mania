import { CORE_CATALOG } from '../definitions/core'
import { versionAssetPath } from './assetVersion'

export type GameAssetGroup = 'boot' | 'menu' | 'game'

export interface GameAsset {
	id: string
	src: string
	group: GameAssetGroup
	critical: boolean
	kind: 'image'
}

export const GAME_ASSET_PATHS = {
	logo: versionAssetPath('/assets/logo.png'),
	menuBackground: versionAssetPath('/assets/backgrounds/menu-bg.png'),
	boardBackground: versionAssetPath('/assets/backgrounds/board-bg.png'),
	cardBack: versionAssetPath('/assets/cards/card-back.png'),
} as const

const catalogAssets: GameAsset[] = [
	...Object.values(CORE_CATALOG.playerCards).map((card) => ({
		id: `player-card:${card.id}`,
		src: card.assetPath,
		group: 'game' as const,
		critical: false,
		kind: 'image' as const,
	})),
	...Object.values(CORE_CATALOG.regularMonsters).map((monster) => ({
		id: `monster:${monster.id}`,
		src: monster.assetPath,
		group: 'game' as const,
		critical: false,
		kind: 'image' as const,
	})),
	{
		id: `monster:${CORE_CATALOG.suddenDeathMonster.id}`,
		src: CORE_CATALOG.suddenDeathMonster.assetPath,
		group: 'game',
		critical: false,
		kind: 'image',
	},
]

export const GAME_ASSETS: GameAsset[] = [
	{
		id: 'logo',
		src: GAME_ASSET_PATHS.logo,
		group: 'boot',
		critical: true,
		kind: 'image',
	},
	{
		id: 'menu-background',
		src: GAME_ASSET_PATHS.menuBackground,
		group: 'menu',
		critical: true,
		kind: 'image',
	},
	{
		id: 'board-background',
		src: GAME_ASSET_PATHS.boardBackground,
		group: 'game',
		critical: false,
		kind: 'image',
	},
	{
		id: 'card-back',
		src: GAME_ASSET_PATHS.cardBack,
		group: 'game',
		critical: false,
		kind: 'image',
	},
	...catalogAssets,
]

export const MENU_CRITICAL_ASSETS = GAME_ASSETS.filter(
	(asset) => asset.critical && (asset.group === 'boot' || asset.group === 'menu'),
)

export const GAMEPLAY_ASSETS = GAME_ASSETS.filter((asset) => asset.group === 'game')
