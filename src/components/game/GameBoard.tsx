import { useEffect, useRef } from 'react'
import { CORE_CATALOG } from '../../game/definitions/core'
import type { GameCatalog, PlayerCardInstance, PlayerId } from '../../game/definitions/types'
import type { GameAction, GameState } from '../../game/engine/types'
import {
	canDefeatMonster,
	canUseUltimateWeapon,
	getActiveMonsterDefinitions,
	getCurrentPlayer,
	getPlayer,
	getPlayerScore,
} from '../../game/selectors/gameSelectors'
import { MonsterCard } from '../cards/MonsterCard'
import { CardBack } from '../cards/CardBack'
import { PlayerCardRenderer } from '../cards/PlayerCardRenderer'
import { DefeatedDialog } from './DefeatedDialog'

interface GameBoardProps {
	state: GameState
	localPlayerId: PlayerId
	onAction: (action: GameAction) => void
	catalog?: GameCatalog
	compact?: boolean
}

export function GameBoard({
	state,
	localPlayerId,
	onAction,
	catalog = CORE_CATALOG,
	compact = false,
}: GameBoardProps) {
	const localPlayer = getPlayer(state, localPlayerId) ?? state.players[0]
	const currentPlayer = getCurrentPlayer(state)
	const isLocalTurn = currentPlayer.id === localPlayerId && state.phase !== 'game-over'
	const monsters = getActiveMonsterDefinitions(state, catalog)
	const ultimate = localPlayer.hand.find(
		(card) => catalog.playerCards[card.definitionId]?.category === 'ultimate-weapon',
	)
	const statusMessage = state.events.at(-1)?.message ?? 'Game ready.'
	const pendingForLocalPlayer = state.pendingDiscard?.playerId === localPlayerId
	const victoryRef = useRef<HTMLElement>(null)

	useEffect(() => {
		if (state.phase === 'game-over') {
			victoryRef.current?.focus()
		}
	}, [state.phase])

	const activateCard = (card: PlayerCardInstance) => {
		if (pendingForLocalPlayer) {
			onAction({ type: 'SELECT_DISCARD', playerId: localPlayerId, cardInstanceId: card.instanceId })
			return
		}
		if (catalog.playerCards[card.definitionId]?.category === 'action') {
			onAction({ type: 'PLAY_ACTION_CARD', playerId: localPlayerId, cardInstanceId: card.instanceId })
		}
	}

	return (
		<main className={`game-board${compact ? ' compact-board' : ''}`}>
		<header className="board-header">
			<img src="/assets/logo.png" alt="Monster Mania" className="board-logo" />
			<div className="turn-status">
				<span className="eyebrow">Turn {state.turn.number}</span>
				<strong>{state.phase === 'game-over' ? 'Game over' : `${currentPlayer.name}'s turn`}</strong>
				<span>{state.mode === 'sudden-death' ? 'Sudden Death · hand limit 4' : 'Action Phase · hand limit 5'}</span>
			</div>
			<div className="score-strip" aria-label="Scores">
				{state.players.map((player) => (
					<DefeatedDialog
						key={player.id}
						player={player}
						catalog={catalog}
						score={getPlayerScore(state, player.id, catalog)}
					/>
				))}
			</div>
		</header>

		<p className="game-announcement" role="status" aria-live="polite">
			{statusMessage}
		</p>

		<section className="arena" aria-labelledby="arena-title">
			<div className="section-heading">
				<div>
					<span className="eyebrow">The arena</span>
					<h2 id="arena-title">{state.mode === 'sudden-death' ? 'Defeat the Infinity Beast' : 'Face-up Monsters'}</h2>
				</div>
				<div className="deck-counts" aria-label="Deck counts">
					<span>Monster deck <strong>{state.monsterDeck.length}</strong></span>
					<span>Draw pile <strong>{state.drawPile.length}</strong></span>
				</div>
			</div>
			<div className="monster-row">
				{monsters.map((monster) => (
					<MonsterCard
						key={monster.id}
						monster={monster}
						canDefeat={isLocalTurn && canDefeatMonster(state, localPlayerId, monster.id, catalog)}
						canUseUltimate={Boolean(
							isLocalTurn &&
							ultimate &&
							canUseUltimateWeapon(state, localPlayerId, ultimate.instanceId, monster.id, catalog),
						)}
						disabledReason={isLocalTurn ? 'Your hand is missing a required Weapon.' : 'Wait for your turn.'}
						onDefeat={() => onAction({ type: 'DEFEAT_MONSTER', playerId: localPlayerId, monsterId: monster.id })}
						onUseUltimate={() =>
						ultimate &&
						onAction({
							type: 'USE_ULTIMATE_WEAPON',
							playerId: localPlayerId,
							cardInstanceId: ultimate.instanceId,
							monsterId: monster.id,
						})
					}
					/>
				))}
			</div>
		</section>

		<section className="player-zone" aria-labelledby="hand-title">
			<div className="section-heading">
				<div>
					<span className="eyebrow">Your cards</span>
					<h2 id="hand-title">{localPlayer.name}'s hand</h2>
				</div>
				<span className="opponent-hand">
					<CardBack count={state.players.find((player) => player.id !== localPlayerId)?.hand.length ?? 0} label="opponent card" />
				</span>
			</div>
			<div className="player-hand">
				{localPlayer.hand.map((card) => {
					const definition = catalog.playerCards[card.definitionId]
					const isAction = definition.category === 'action'
					const selected = state.pendingDiscard?.selectedCardInstanceIds.includes(card.instanceId) ?? false
					const canActivate = pendingForLocalPlayer || (isLocalTurn && state.turn.actionPhaseOpen && isAction)
					return (
						<PlayerCardRenderer
							key={card.instanceId}
							definition={definition}
							onActivate={() => activateCard(card)}
							disabled={!canActivate}
							disabledReason={
								pendingForLocalPlayer
									? undefined
									: isAction
										? 'Action cards can only be played during your Action Phase.'
										: 'Weapons are spent automatically when you choose a beatable Monster.'
							}
							selected={selected}
						/>
					)
				})}
			</div>
			<div className="turn-controls">
				{pendingForLocalPlayer ? (
					<>
						<p>
							Select {state.pendingDiscard!.requiredCount} card{state.pendingDiscard!.requiredCount === 1 ? '' : 's'} to discard.
						</p>
						<button
							type="button"
							className="primary-button"
							disabled={state.pendingDiscard!.selectedCardInstanceIds.length !== state.pendingDiscard!.requiredCount}
							onClick={() => onAction({ type: 'CONFIRM_DISCARD', playerId: localPlayerId })}
						>
							Confirm discard
						</button>
					</>
				) : (
					<button
						type="button"
						className="secondary-button"
						disabled={!isLocalTurn || state.phase !== 'action'}
						title={!isLocalTurn ? 'Wait for your turn.' : 'Draw one card and end your turn.'}
						onClick={() => onAction({ type: 'SKIP_TURN', playerId: localPlayerId })}
					>
						Skip turn
					</button>
				)}
			</div>
		</section>

		<aside className="event-log" aria-labelledby="event-log-title">
			<h2 id="event-log-title">Game messages</h2>
			<ol>
				{state.events.slice(-6).reverse().map((event) => <li key={event.id}>{event.message}</li>)}
			</ol>
		</aside>

		{state.phase === 'game-over' ? (
			<section
				ref={victoryRef}
				className="victory-panel"
				role="dialog"
				aria-modal="true"
				aria-labelledby="victory-title"
				tabIndex={-1}
			>
				<span className="eyebrow">Match complete</span>
				<h2 id="victory-title">{getPlayer(state, state.winnerId ?? '')?.name} wins!</h2>
				<p>{statusMessage}</p>
			</section>
		) : null}
	</main>
	)
}
