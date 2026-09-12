import { GAME_ASSET_PATHS } from '../../game/assets/assetManifest'
import { useEffect, useRef } from 'react'
import type { GameCatalog, PlayerId } from '../../game/definitions/types'
import type { GameState } from '../../game/engine/types'
import { getPlayer, getPlayerScore } from '../../game/selectors/gameSelectors'

interface MatchResultDialogProps {
	state: GameState
	localPlayerId: PlayerId
	catalog: GameCatalog
	onPlayAgain?: () => void
	onReturnToMenu?: () => void
}

export function MatchResultDialog({
	state,
	localPlayerId,
	catalog,
	onPlayAgain,
	onReturnToMenu,
}: MatchResultDialogProps) {
	const dialogRef = useRef<HTMLDialogElement>(null)
	const winner = getPlayer(state, state.winnerId ?? '')
	const localWon = winner?.id === localPlayerId

	useEffect(() => {
		if (!dialogRef.current?.open) dialogRef.current?.showModal()
	}, [])

	return (
		<dialog ref={dialogRef} className="match-result-dialog" aria-labelledby="match-result-title">
			<img src={GAME_ASSET_PATHS.logo} alt="" aria-hidden="true" />
			<span className="eyebrow">Match complete</span>
			<h2 id="match-result-title">{localWon ? 'You win!' : `${winner?.name ?? 'Opponent'} wins`}</h2>
			<p>{state.events.at(-1)?.message}</p>
			<div className="final-score" aria-label="Final score">
				{state.players.map((player) => (
					<div key={player.id}>
						<span>{player.id === localPlayerId ? 'You' : player.name}</span>
						<strong>{getPlayerScore(state, player.id, catalog)}</strong>
						<small>{player.defeatedMonsterIds.length} defeated</small>
					</div>
				))}
			</div>
			{onPlayAgain && onReturnToMenu ? (
				<div className="result-actions">
					<button type="button" className="primary-button" onClick={onPlayAgain} autoFocus>Play again</button>
					<button type="button" className="secondary-button" onClick={onReturnToMenu}>Return to menu</button>
				</div>
			) : null}
		</dialog>
	)
}
