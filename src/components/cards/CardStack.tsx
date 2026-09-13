import type { CSSProperties } from 'react'
import { GAME_ASSET_PATHS } from '../../game/assets/assetManifest'

interface CardStackProps {
	count: number
	label: string
	variant?: 'hand' | 'deck'
	maxVisible?: number
}

export function CardStack({ count, label, variant = 'hand', maxVisible = 7 }: CardStackProps) {
	const visibleCount = Math.min(count, maxVisible)
	return (
		<div className={`physical-card-stack ${variant}`} aria-label={`${label}: ${count} card${count === 1 ? '' : 's'}`}>
			<div className="stack-cards" aria-hidden="true">
				{Array.from({ length: visibleCount }, (_, index) => (
					<img
						key={index}
						src={GAME_ASSET_PATHS.cardBack}
						alt=""
						draggable={false}
						style={{ '--card-index': index } as CSSProperties}
					/>
				))}
				{count === 0 ? <span className="empty-card-slot" /> : null}
			</div>
			<span className="stack-label">
				<span>{label}</span>
				<strong>{count}<small> card{count === 1 ? '' : 's'}</small></strong>
			</span>
		</div>
	)
}
