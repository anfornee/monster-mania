import type { PlayerCardDefinition } from '../../game/definitions/types'

export interface PlayerCardProps {
	definition: PlayerCardDefinition
	disabled?: boolean
	disabledReason?: string
	selected?: boolean
	onActivate?: () => void
}

export function PlayerCard({
	definition,
	disabled = false,
	disabledReason,
	selected = false,
	onActivate,
}: PlayerCardProps) {
	const label = selected
		? `${definition.name}, selected for discard`
		: `${definition.name}, ${definition.category}`
	const image = (
		<img
			src={definition.assetPath}
			alt=""
			className="card-image"
			draggable={false}
		/>
	)

	if (!onActivate) {
		return (
		<article className={`player-card ${definition.category}`} aria-label={label}>
			{image}
			<span className="sr-only">{definition.rulesText}</span>
		</article>
		)
	}

	return (
		<button
			type="button"
			className={`player-card card-button ${definition.category}${selected ? ' selected' : ''}`}
			onClick={onActivate}
			disabled={disabled}
			aria-pressed={selected}
			aria-label={label}
			title={disabled ? disabledReason : definition.rulesText}
		>
			{image}
			{disabled && disabledReason ? <span className="sr-only">Unavailable: {disabledReason}</span> : null}
		</button>
	)
}
