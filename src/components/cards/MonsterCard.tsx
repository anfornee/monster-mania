import type { MonsterDefinition } from '../../game/definitions/types'

interface MonsterCardProps {
	monster: MonsterDefinition
	canDefeat: boolean
	canUseUltimate: boolean
	disabledReason?: string
	onDefeat: () => void
	onUseUltimate: () => void
}

export function MonsterCard({
	monster,
	canDefeat,
	canUseUltimate,
	disabledReason,
	onDefeat,
	onUseUltimate,
}: MonsterCardProps) {
	const points = monster.points === 'infinity' ? 'infinite victory' : `${monster.points} points`
	return (
		<article className={`monster-card${monster.isSuddenDeath ? ' sudden-death-card' : ''}`}>
		<img className="card-image" src={monster.assetPath} alt={`${monster.name}, ${points}`} draggable={false} />
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
		<p className="requirement-text">
			<span>Requires</span> {monster.requiredWeapons.join(' + ')}
		</p>
	</article>
	)
}
