import { useState } from 'react'
import type { GameCatalog } from '../../game/definitions/types'
import {
	filterCardGalleryEntries,
	getCardGalleryEntries,
	type GalleryCategory,
} from '../../game/presentation/cardGalleryCatalog'
import { CardInspector, type InspectableCard } from './CardInspector'

const FILTERS: Array<{ id: GalleryCategory; label: string }> = [
	{ id: 'all', label: 'All' },
	{ id: 'monsters', label: 'Monsters' },
	{ id: 'weapons', label: 'Weapons' },
	{ id: 'actions', label: 'Actions' },
]

export function CardGallery({ catalog, onBack }: { catalog: GameCatalog; onBack?: () => void }) {
	const [category, setCategory] = useState<GalleryCategory>('all')
	const [inspectedCard, setInspectedCard] = useState<InspectableCard | null>(null)
	const entries = getCardGalleryEntries(catalog)
	const visibleEntries = filterCardGalleryEntries(entries, category)

	return (
		<main className="card-gallery-page">
			<nav className="gallery-nav" aria-label="Card gallery navigation">
				<a className="back-button" href="/" onClick={onBack ? (event) => {
					event.preventDefault()
					onBack()
				} : undefined}>← Tavern</a>
				<span>Card gallery</span>
			</nav>
			<header className="gallery-header">
				<span className="eyebrow">The tavern collection</span>
				<h1>Every card. Every creature.</h1>
				<p>Browse the complete Monster Mania core collection. This gallery is for inspection only and is separate from every match.</p>
			</header>
			<div className="gallery-filters" aria-label="Filter cards">
				{FILTERS.map((filter) => (
					<button
						type="button"
						key={filter.id}
						aria-pressed={category === filter.id}
						onClick={() => setCategory(filter.id)}
					>
						{filter.label}
					</button>
				))}
			</div>
			<p className="gallery-count" aria-live="polite">Showing {visibleEntries.length} of {entries.length} cards</p>
			<section className="gallery-grid" aria-label={`${category === 'all' ? 'All' : category} cards`}>
				{visibleEntries.map((entry) => (
					<button
						type="button"
						className="gallery-card"
						key={entry.id}
						onClick={() => setInspectedCard({
							name: entry.name,
							assetPath: entry.assetPath,
							description: entry.description,
							meta: `${entry.categoryLabel} · ${entry.meta}`,
						})}
						aria-label={`Inspect ${entry.name}, ${entry.categoryLabel}`}
					>
						<img src={entry.assetPath} alt="" draggable={false} />
						<span><strong>{entry.name}</strong><small>{entry.categoryLabel}</small></span>
					</button>
				))}
			</section>
			<CardInspector card={inspectedCard} onClose={() => setInspectedCard(null)} />
		</main>
	)
}
