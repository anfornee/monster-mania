import { describe, expect, it } from 'vitest'
import { CORE_CATALOG } from './core'

describe('core catalog', () => {
	it('requires Grenade and Spear to defeat Chomper', () => {
		expect(CORE_CATALOG.regularMonsters.chomper.requiredWeapons).toEqual([
			'grenade',
			'spear',
		])
	})

	it('requires Rifle, Grenade, and Spear to defeat Kraken', () => {
		expect(CORE_CATALOG.regularMonsters.kraken.requiredWeapons).toEqual([
			'gun',
			'grenade',
			'spear',
		])
	})
})
