import type { CSSProperties } from 'react'
import { GAME_ASSET_PATHS } from '../../game/assets/assetManifest'
import type { GameCatalog } from '../../game/definitions/types'
import type { OpponentCardPresentation } from '../../game/presentation/presentationSequence'
import { GAME_TIMING } from '../../game/presentation/aiPacing'

interface OpponentCardRevealProps {
	presentation: OpponentCardPresentation
	catalog: GameCatalog
	onComplete: () => void
}

export function OpponentCardReveal({ presentation, catalog, onComplete }: OpponentCardRevealProps) {
	const definitions = presentation.cardDefinitionIds.map((id) => catalog.playerCards[id]).filter(Boolean)
	const actionLabel = presentation.kind === 'discarded' ? 'discards' : 'plays'
	return (
		<div
			className={`opponent-card-reveal ${presentation.kind}`}
			role="status"
			aria-live="polite"
			aria-label={`${presentation.playerName} ${actionLabel} ${definitions.map((card) => card.name).join(', ')}`}
			style={{ '--opponent-reveal-duration': `${GAME_TIMING.opponentCardReveal}ms` } as CSSProperties}
			onAnimationEnd={(event) => {
				if (event.target === event.currentTarget) onComplete()
			}}
		>
			<span className="eyebrow">{presentation.playerName} {actionLabel}</span>
			<div className="opponent-reveal-cards" aria-hidden="true">
				{definitions.map((definition, index) => (
					<div className="opponent-reveal-card" key={`${definition.id}-${index}`}>
						<div className="opponent-reveal-card-inner">
							<img className="opponent-reveal-back" src={GAME_ASSET_PATHS.cardBack} alt="" draggable={false} />
							<img className="opponent-reveal-front" src={definition.assetPath} alt="" draggable={false} />
						</div>
					</div>
				))}
			</div>
			<strong>{definitions.map((card) => card.name).join(' + ')}</strong>
		</div>
	)
}
