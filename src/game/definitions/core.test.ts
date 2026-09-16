import { describe, expect, it } from 'vitest'
import { CORE_CATALOG } from './core'

describe('core catalog', () => {
	it('requires Grenade and Spear to defeat Chomper', () => {
		expect(CORE_CATALOG.regularMonsters.chomper.requiredWeapons).toEqual([
			'grenade',
			'spear',
		])
	})

	it.each([
		['top', ['sword', 'grenade']],
		['smasher', ['mace', 'bow']],
		['wrecking-snake', ['sword', 'spear']],
		['boom-boom', ['gun', 'spear']],
		['spikey', ['sword', 'bow', 'spear']],
		['kraken', ['grenade', 'gun', 'spear']],
	])('preserves the intended Weapon display order for %s', (monsterId, requiredWeapons) => {
		expect(CORE_CATALOG.regularMonsters[monsterId].requiredWeapons).toEqual(requiredWeapons)
	})
})
