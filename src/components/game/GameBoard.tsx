import { useEffect, useRef, useState } from 'react'
import { CORE_CATALOG } from '../../game/definitions/core'
import type { GameCatalog, PlayerCardInstance, PlayerId } from '../../game/definitions/types'
import type { GameAction, GameState } from '../../game/engine/types'
import { useGameAudio } from '../../game/audio/useGameAudio'
import type { GamePresentationStep } from '../../game/presentation/presentationSequence'
import {
	canDefeatMonster,
	canUseUltimateWeapon,
	getActiveMonsterDefinitions,
	getCurrentPlayer,
	getOpponent,
	getPlayer,
	getPlayerScore,
} from '../../game/selectors/gameSelectors'
import { CardInspector, type InspectableCard } from '../cards/CardInspector'
import { CardStack } from '../cards/CardStack'
import { MonsterCard } from '../cards/MonsterCard'
import { PlayerCardRenderer } from '../cards/PlayerCardRenderer'
import { DefeatedDialog } from './DefeatedDialog'
import { GameAnnouncement } from './GameAnnouncement'
import { MatchResultDialog } from './MatchResultDialog'
import { OpponentCardReveal } from './OpponentCardReveal'

interface GameBoardProps {
	state: GameState
	localPlayerId: PlayerId
	onAction: (action: GameAction) => void
	onPlayAgain?: () => void
	onReturnToMenu?: () => void
	onRequestRematch?: () => void
	rematchRequested?: boolean
	opponentRematchRequested?: boolean
	rematchPending?: boolean
	catalog?: GameCatalog
	compact?: boolean
	actionsResolving?: boolean
	presentationStep?: GamePresentationStep | null
	onPresentationComplete?: () => void
}

function getRequirementStatus(
	hand: PlayerCardInstance[],
	requiredWeapons: string[],
	catalog: GameCatalog,
): boolean[] {
	const available = hand.map((card) => catalog.playerCards[card.definitionId])
	const used = new Set<number>()
	return requiredWeapons.map((weaponId) => {
		const match = available.findIndex(
			(definition, index) =>
				!used.has(index) && definition?.category === 'weapon' && definition.weaponId === weaponId,
		)
		if (match < 0) return false
		used.add(match)
		return true
	})
}

export function GameBoard({
	state,
	localPlayerId,
	onAction,
	onPlayAgain,
	onReturnToMenu,
	onRequestRematch,
	rematchRequested,
	opponentRematchRequested,
	rematchPending,
	catalog = CORE_CATALOG,
	compact = false,
	actionsResolving = false,
	presentationStep = null,
	onPresentationComplete,
}: GameBoardProps) {
	const resultPresented = state.phase === 'game-over' && !presentationStep
	useGameAudio(state, localPlayerId, resultPresented)
	const localPlayer = getPlayer(state, localPlayerId) ?? state.players[0]
	const opponent = getOpponent(state, localPlayerId)
	const currentPlayer = getCurrentPlayer(state)
	const isLocalTurn = currentPlayer.id === localPlayerId && state.phase !== 'game-over' && !actionsResolving
	const monsters = getActiveMonsterDefinitions(state, catalog)
	const ultimate = localPlayer.hand.find(
		(card) => catalog.playerCards[card.definitionId]?.category === 'ultimate-weapon',
	)
	const statusMessage = state.events.at(-1)?.message ?? 'Game ready.'
	const pendingForLocalPlayer = state.pendingDiscard?.playerId === localPlayerId
	const [inspectedCard, setInspectedCard] = useState<InspectableCard | null>(null)
	const [handScrollCues, setHandScrollCues] = useState({ left: false, right: false })
	const handRef = useRef<HTMLDivElement>(null)
	const handCardCount = localPlayer.hand.length

	useEffect(() => {
		const hand = handRef.current
		if (!hand) return

		const updateScrollCue = () => {
			const remainingScroll = hand.scrollWidth - hand.clientWidth - hand.scrollLeft
			const nextCues = {
				left: hand.scrollLeft > 1,
				right: remainingScroll > 1,
			}
			setHandScrollCues((current) => (
				current.left === nextCues.left && current.right === nextCues.right ? current : nextCues
			))
		}
		const frame = window.requestAnimationFrame(updateScrollCue)
		const resizeObserver = typeof ResizeObserver === 'undefined'
			? null
			: new ResizeObserver(updateScrollCue)

		hand.addEventListener('scroll', updateScrollCue, { passive: true })
		window.addEventListener('resize', updateScrollCue)
		resizeObserver?.observe(hand)

		return () => {
			window.cancelAnimationFrame(frame)
			hand.removeEventListener('scroll', updateScrollCue)
			window.removeEventListener('resize', updateScrollCue)
			resizeObserver?.disconnect()
		}
	}, [handCardCount])

	const scrollHand = (direction: -1 | 1) => {
		const hand = handRef.current
		if (!hand) return
		const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
		hand.scrollBy({
			left: direction * Math.max(hand.clientWidth * .7, 120),
			behavior: reduceMotion ? 'auto' : 'smooth',
		})
	}

	const activateCard = (card: PlayerCardInstance) => {
		if (pendingForLocalPlayer && !actionsResolving) {
			onAction({ type: 'SELECT_DISCARD', playerId: localPlayerId, cardInstanceId: card.instanceId })
			return
		}
		const definition = catalog.playerCards[card.definitionId]
		const playable = isLocalTurn && state.turn.actionPhaseOpen && definition.category === 'action'
		setInspectedCard({
			name: definition.name,
			assetPath: definition.assetPath,
			description: definition.rulesText,
			meta: definition.category.replace('-', ' '),
			playLabel: 'Play card',
			onPlay: playable
				? () => onAction({ type: 'PLAY_ACTION_CARD', playerId: localPlayerId, cardInstanceId: card.instanceId })
				: undefined,
		})
	}

	return (
		<main className={`game-board${compact ? ' compact-board' : ''}${presentationStep ? ' presentation-paused' : ''}`}>
			<div className="table-grain" aria-hidden="true" />

			<section className={`table-seat opponent-seat${currentPlayer.id === opponent.id ? ' active-seat' : ''}`} aria-labelledby="opponent-name">
				<div className="seat-identity">
					<span className="seat-marker" aria-hidden="true">M</span>
					<div>
						<span className="eyebrow">Across the table</span>
						<h2 id="opponent-name">{opponent.name}</h2>
					</div>
				</div>
				<div className="opponent-cards">
					<CardStack count={opponent.hand.length} label={`${opponent.name}'s hand`} />
				</div>
				<div className="seat-score">
					<DefeatedDialog player={opponent} catalog={catalog} score={getPlayerScore(state, opponent.id, catalog)} />
				</div>
			</section>

			<div className="turn-status">
				<section className="turn-plaque" aria-live="polite">
					<span>Turn {state.turn.number}</span>
					<strong>{state.phase === 'game-over' ? 'Match complete' : currentPlayer.id === localPlayerId ? 'Your turn' : `${currentPlayer.name} is thinking`}</strong>
					<small>{state.mode === 'sudden-death' ? 'Sudden Death · hand limit 4' : pendingForLocalPlayer ? 'Choose cards to discard' : 'Action Phase · hand limit 5'}</small>
				</section>
				<details className="game-log">
					<summary>Hunter's journal <span>{state.events.length} entries</span></summary>
					<ol>
						{[...state.events].reverse().map((event) => <li key={event.id}>{event.message}</li>)}
					</ol>
				</details>
			</div>

			<section className="arena" aria-labelledby="arena-title">
				<div className="arena-heading">
					<div>
						<span className="eyebrow">The hunt</span>
						<h1 id="arena-title">{state.mode === 'sudden-death' ? 'The Infinity Beast' : 'Monsters in the arena'}</h1>
					</div>
				</div>
				<div className="arena-table-layout">
					<div className="board-deck draw-deck">
						<CardStack count={state.drawPile.length} label="Draw deck" variant="deck" maxVisible={4} />
					</div>
					<div className="monster-row">
						{monsters.map((monster) => {
							const requirementStatus = getRequirementStatus(localPlayer.hand, monster.requiredWeapons, catalog)
							return (
								<MonsterCard
									key={monster.id}
									monster={monster}
									canDefeat={isLocalTurn && canDefeatMonster(state, localPlayerId, monster.id, catalog)}
									canUseUltimate={Boolean(
										isLocalTurn && ultimate && canUseUltimateWeapon(state, localPlayerId, ultimate.instanceId, monster.id, catalog),
									)}
									disabledReason={isLocalTurn ? 'Your hand is missing a required Weapon.' : 'Wait for your turn.'}
									requirementStatus={requirementStatus}
									onInspect={() => setInspectedCard({
										name: monster.name,
										assetPath: monster.assetPath,
										description: monster.lore,
										meta: `${monster.points === 'infinity' ? 'Victory' : `${monster.points} point${monster.points === 1 ? '' : 's'}`} · Requires ${monster.requiredWeapons.join(', ')}`,
									})}
									onDefeat={() => onAction({ type: 'DEFEAT_MONSTER', playerId: localPlayerId, monsterId: monster.id })}
									onUseUltimate={() => ultimate && onAction({
										type: 'USE_ULTIMATE_WEAPON',
										playerId: localPlayerId,
										cardInstanceId: ultimate.instanceId,
										monsterId: monster.id,
									})}
								/>
							)
						})}
					</div>
					<div className="board-deck monster-deck">
						<CardStack count={state.monsterDeck.length} label="Monster deck" variant="deck" maxVisible={4} />
					</div>
				</div>
			</section>

			<p className="latest-event" aria-live="polite"><span aria-hidden="true" />{statusMessage}</p>

			<section className={`table-seat player-seat${currentPlayer.id === localPlayerId && state.phase !== 'game-over' ? ' active-seat' : ''}`} aria-labelledby="hand-title">
				<div className="player-seat-header">
					<div className="seat-identity">
						<span className="seat-marker local" aria-hidden="true">Y</span>
						<div>
							<span className="eyebrow">Your side</span>
							<h2 id="hand-title">Your hand <small>{localPlayer.hand.length} cards</small></h2>
						</div>
					</div>
					<DefeatedDialog player={localPlayer} catalog={catalog} score={getPlayerScore(state, localPlayer.id, catalog)} />
				</div>
				<div className="player-hand-scroll">
					<div className="player-hand" ref={handRef}>
						{localPlayer.hand.map((card) => {
							const definition = catalog.playerCards[card.definitionId]
							const isAction = definition.category === 'action'
							const selected = state.pendingDiscard?.selectedCardInstanceIds.includes(card.instanceId) ?? false
							const playable = pendingForLocalPlayer || (isLocalTurn && state.turn.actionPhaseOpen && isAction)
							return (
								<PlayerCardRenderer
									key={card.instanceId}
									definition={definition}
									onActivate={() => activateCard(card)}
									disabled={false}
									playable={playable}
									selected={selected}
								/>
							)
						})}
					</div>
					{handScrollCues.left ? (
						<button
							type="button"
							className="hand-scroll-cue hand-scroll-cue-left"
							aria-label="Scroll hand to the left"
							onClick={() => scrollHand(-1)}
						>
							<span aria-hidden="true">‹</span>
						</button>
					) : null}
					{handScrollCues.right ? (
						<button
							type="button"
							className="hand-scroll-cue hand-scroll-cue-right"
							aria-label="Scroll hand to the right"
							onClick={() => scrollHand(1)}
						>
							<span aria-hidden="true">›</span>
						</button>
					) : null}
				</div>
				<div className="turn-controls">
					{pendingForLocalPlayer ? (
						<div className="discard-controls">
							<p>Select {state.pendingDiscard!.requiredCount} card{state.pendingDiscard!.requiredCount === 1 ? '' : 's'} to discard.</p>
							<button
								type="button"
								className="primary-button"
								disabled={actionsResolving || state.pendingDiscard!.selectedCardInstanceIds.length !== state.pendingDiscard!.requiredCount}
								onClick={() => onAction({ type: 'CONFIRM_DISCARD', playerId: localPlayerId })}
							>
								Confirm discard
							</button>
						</div>
					) : (
						<button
							type="button"
							className="end-turn-button"
							disabled={!isLocalTurn || state.phase !== 'action'}
							title={!isLocalTurn ? 'Wait for your turn.' : 'Draw one card and end your turn.'}
							onClick={() => onAction({ type: 'SKIP_TURN', playerId: localPlayerId })}
						>
							End turn
						</button>
					)}
				</div>
			</section>

			<CardInspector card={inspectedCard} onClose={() => setInspectedCard(null)} />
			{presentationStep?.type === 'opponent-card' ? (
				<OpponentCardReveal
					key={presentationStep.card.id}
					presentation={presentationStep.card}
					catalog={catalog}
					onComplete={() => onPresentationComplete?.()}
				/>
			) : null}
			{presentationStep?.type === 'announcement' ? (
				<GameAnnouncement
					key={presentationStep.announcement.eventId}
					announcement={presentationStep.announcement}
					onComplete={onPresentationComplete}
				/>
			) : null}
			{state.phase === 'game-over' && !presentationStep ? (
				<MatchResultDialog
					state={state}
					localPlayerId={localPlayerId}
					catalog={catalog}
					onPlayAgain={onPlayAgain}
					onReturnToMenu={onReturnToMenu}
					onRequestRematch={onRequestRematch}
					rematchRequested={rematchRequested}
					opponentRematchRequested={opponentRematchRequested}
					rematchPending={rematchPending}
				/>
			) : null}
		</main>
	)
}
