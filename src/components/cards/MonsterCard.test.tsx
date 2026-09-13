import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { MonsterDefinition } from '../../game/definitions/types'
import { MonsterCard } from './MonsterCard'

describe('Monster requirement indicators', () => {
	for (const count of [1, 2, 3, 4]) {
		it(`renders all ${count} requirements`, () => {
			const monster: MonsterDefinition = {
				id: `test-${count}`,
				name: `Test Monster ${count}`,
				points: 1,
				requiredWeapons: ['bow', 'grenade', 'mace', 'sword'].slice(0, count),
				assetPath: '/test.jpg',
				lore: 'Test monster.',
			}
			const markup = renderToStaticMarkup(
				<MonsterCard
					monster={monster}
					canDefeat={false}
					canUseUltimate={false}
					onDefeat={() => undefined}
					onUseUltimate={() => undefined}
					onInspect={() => undefined}
					requirementStatus={Array.from({ length: count }, () => false)}
				/>,
			)
			expect(markup.match(/requirement-pill/g)).toHaveLength(count)
			expect(markup).toContain(`requirement-count-${count}`)
		})
	}
})
