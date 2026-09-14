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
	onRequestRematch?: () => void
	rematchRequested?: boolean
	opponentRematchRequested?: boolean
	rematchPending?: boolean
}

export function MatchResultDialog({
	state,
	localPlayerId,
	catalog,
	onPlayAgain,
	onReturnToMenu,
	onRequestRematch,
	rematchRequested = false,
	opponentRematchRequested = false,
	rematchPending = false,
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
			{onRequestRematch || onPlayAgain || onReturnToMenu ? (
				<div className="result-actions">
					{onRequestRematch ? (
						<p className="rematch-status" role="status" aria-live="polite">
							{rematchRequested
								? 'Waiting for your opponent to accept a rematch.'
								: opponentRematchRequested
									? 'Your opponent has requested a rematch.'
									: 'Both players must request a rematch before a new match begins.'}
						</p>
					) : null}
					<div className="result-action-buttons">
						{onRequestRematch ? (
							<button
								type="button"
								className="primary-button"
								onClick={onRequestRematch}
								disabled={rematchRequested || rematchPending}
								autoFocus
							>
								{rematchPending
									? opponentRematchRequested ? 'Accepting rematch…' : 'Requesting rematch…'
									: rematchRequested
										? 'Rematch requested'
										: opponentRematchRequested ? 'Accept rematch' : 'Request rematch'}
							</button>
						) : null}
						{onPlayAgain ? <button type="button" className="primary-button" onClick={onPlayAgain} autoFocus>Play again</button> : null}
						{onReturnToMenu ? (
							<button type="button" className="secondary-button" onClick={onReturnToMenu}>
								{onRequestRematch ? 'Walk Away' : 'Return to menu'}
							</button>
						) : null}
					</div>
				</div>
			) : null}
		</dialog>
	)
}
