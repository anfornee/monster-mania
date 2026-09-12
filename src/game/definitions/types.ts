export type PlayerId = string
export type PlayerCardDefinitionId = string
export type CardInstanceId = string
export type MonsterId = string
export type WeaponId = string

export type PlayerCardCategory = 'weapon' | 'action' | 'ultimate-weapon'

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export interface ActionEffect {
	type: string
	[key: string]: JsonValue
}

export type UltimateWeaponEffect = {
	type: 'defeat-regular-monster'
}

interface PlayerCardDefinitionBase {
	id: PlayerCardDefinitionId
	name: string
	category: PlayerCardCategory
	copies: number
	assetPath: string
	rulesText: string
}

export interface WeaponCardDefinition extends PlayerCardDefinitionBase {
	category: 'weapon'
	weaponId: WeaponId
}

export interface ActionCardDefinition extends PlayerCardDefinitionBase {
	category: 'action'
	effect: ActionEffect
}

export interface UltimateWeaponCardDefinition extends PlayerCardDefinitionBase {
	category: 'ultimate-weapon'
	effect: UltimateWeaponEffect
}

export type PlayerCardDefinition =
	| WeaponCardDefinition
	| ActionCardDefinition
	| UltimateWeaponCardDefinition

export interface PlayerCardInstance {
	instanceId: CardInstanceId
	definitionId: PlayerCardDefinitionId
}

export interface MonsterDefinition {
	id: MonsterId
	name: string
	points: number | 'infinity'
	requiredWeapons: WeaponId[]
	assetPath: string
	lore: string
	isSuddenDeath?: boolean
}

export interface GameCatalog {
	id: string
	playerCards: Record<PlayerCardDefinitionId, PlayerCardDefinition>
	regularMonsters: Record<MonsterId, MonsterDefinition>
	suddenDeathMonster: MonsterDefinition
}
