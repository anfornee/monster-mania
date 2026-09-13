import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CORE_CATALOG } from '../../game/definitions/core'
import { filterCardGalleryEntries, getCardGalleryEntries } from '../../game/presentation/cardGalleryCatalog'
import { CardGallery } from './CardGallery'

describe('card gallery catalog', () => {
	it('represents every registered card definition exactly once', () => {
		const entries = getCardGalleryEntries(CORE_CATALOG)
		const expectedCount = Object.keys(CORE_CATALOG.playerCards).length
			+ Object.keys(CORE_CATALOG.regularMonsters).length
			+ 1
		expect(entries).toHaveLength(expectedCount)
		expect(new Set(entries.map((entry) => entry.id)).size).toBe(expectedCount)
		expect(entries.some((entry) => entry.name === 'Black Hole')).toBe(true)
		expect(entries.some((entry) => entry.name === 'The Infinity Beast')).toBe(true)
	})

	it('filters entries by the visible categories', () => {
		const entries = getCardGalleryEntries(CORE_CATALOG)
		for (const category of ['monsters', 'weapons', 'actions'] as const) {
			const filtered = filterCardGalleryEntries(entries, category)
			expect(filtered.length).toBeGreaterThan(0)
			expect(filtered.every((entry) => entry.category === category)).toBe(true)
		}
		expect(filterCardGalleryEntries(entries, 'all')).toEqual(entries)
	})

	it('renders inspection controls without gameplay actions', () => {
		const markup = renderToStaticMarkup(<CardGallery catalog={CORE_CATALOG} />)
		expect(markup).toContain('Showing 27 of 27 cards')
		expect(markup).toContain('Inspect Black Hole, Ultimate Weapon')
		expect(markup).not.toContain('Play card')
	})
})
