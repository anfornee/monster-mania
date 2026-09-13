import type { MonsterDefinition } from '../../game/definitions/types'

interface MonsterCardProps {
	monster: MonsterDefinition
	canDefeat: boolean
	canUseUltimate: boolean
	disabledReason?: string
	onDefeat: () => void
	onUseUltimate: () => void
	onInspect: () => void
	requirementStatus: boolean[]
}

export function MonsterCard({
	monster,
	canDefeat,
	canUseUltimate,
	disabledReason,
	onDefeat,
	onUseUltimate,
	onInspect,
	requirementStatus,
}: MonsterCardProps) {
	const points = monster.points === 'infinity' ? 'infinite victory' : `${monster.points} points`
	return (
		<article className={`monster-card${monster.isSuddenDeath ? ' sudden-death-card' : ''}${canDefeat ? ' beatable' : ''}`}>
		<button type="button" className="monster-inspect-button" onClick={onInspect} aria-label={`Inspect ${monster.name}, ${points}`}>
			<img className="card-image" src={monster.assetPath} alt="" draggable={false} />
			<span className="inspect-hint">View card</span>
		</button>
		<div className={`requirement-strip requirement-count-${monster.requiredWeapons.length}`} aria-label={`Requires ${monster.requiredWeapons.join(', ')}`}>
			{monster.requiredWeapons.map((weapon, index) => (
				<span key={`${weapon}-${index}`} className={`requirement-pill${requirementStatus[index] ? ' requirement-ready' : ''}`}>
					<b aria-hidden="true">{requirementStatus[index] ? '✓' : '—'}</b>
					{weapon === 'gun' ? 'Rifle' : `${weapon[0].toUpperCase()}${weapon.slice(1)}`}
				</span>
			))}
		</div>
		<div className="monster-actions">
			<button
				type="button"
				onClick={onDefeat}
				disabled={!canDefeat}
				title={canDefeat ? `Spend ${monster.requiredWeapons.join(', ')}` : disabledReason}
			>
				Defeat with Weapons
			</button>
			{canUseUltimate ? (
				<button type="button" className="void-button" onClick={onUseUltimate}>
					Use Ultimate Weapon
				</button>
			) : null}
		</div>
	</article>
	)
}
