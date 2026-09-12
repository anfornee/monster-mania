import { useRef } from 'react'
import type { GameCatalog } from '../../game/definitions/types'
import type { PlayerState } from '../../game/engine/types'

interface DefeatedDialogProps {
	player: PlayerState
	catalog: GameCatalog
	score: number
}

export function DefeatedDialog({ player, catalog, score }: DefeatedDialogProps) {
	const dialogRef = useRef<HTMLDialogElement>(null)
	return (
		<>
		<button type="button" className="pile-button" onClick={() => dialogRef.current?.showModal()}>
			<span className="score-value">{score}</span>
			<span className="score-copy"><strong>points</strong><small>{player.defeatedMonsterIds.length} defeated</small></span>
		</button>
		<dialog
			ref={dialogRef}
			className="defeated-dialog"
			aria-labelledby={`defeated-${player.id}`}
			onCancel={(event) => {
				event.preventDefault()
				dialogRef.current?.close()
			}}
		>
			<div className="dialog-heading">
				<h2 id={`defeated-${player.id}`}>{player.name}'s defeated Monsters</h2>
				<button type="button" onClick={() => dialogRef.current?.close()} aria-label="Close defeated Monsters">
					×
				</button>
			</div>
			{player.defeatedMonsterIds.length === 0 ? (
				<p>No Monsters defeated yet.</p>
			) : (
				<div className="defeated-grid">
					{player.defeatedMonsterIds.map((monsterId) => {
						const monster = catalog.regularMonsters[monsterId]
						return (
							<img key={monsterId} src={monster.assetPath} alt={`${monster.name}, ${monster.points} points`} />
						)
					})}
				</div>
			)}
		</dialog>
		</>
	)
}
