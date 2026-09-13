import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CORE_CATALOG } from '../../game/definitions/core'
import { applyGameAction } from '../../game/engine/applyGameAction'
import { createSandboxScenario } from '../../game/sandbox/presets'
import { GameBoard } from './GameBoard'

describe('table presentation privacy and actions', () => {
	it('renders only card backs and a count for the opponent hand', () => {
		const state = structuredClone(createSandboxScenario('fresh-game').state)
		state.players[1].hand = state.players[1].hand.map((card, index) => ({
			...card,
			definitionId: `secret-opponent-${index}`,
		}))
		const markup = renderToStaticMarkup(
			<GameBoard state={state} localPlayerId="player-1" onAction={() => undefined} />,
		)
		expect(markup).toContain(`${state.players[1].name}&#x27;s hand: 3 cards`)
		expect(markup).not.toContain('secret-opponent')
		expect(markup.match(/card-back\.png/g)?.length).toBeGreaterThanOrEqual(3)
	})

	it('distinguishes a playable Action from inspect-only cards', () => {
		const state = createSandboxScenario('action-chain').state
		const markup = renderToStaticMarkup(
			<GameBoard state={state} localPlayerId="player-1" onAction={() => undefined} />,
		)
		expect(markup).toContain('Play or inspect Draw 2')
		expect(markup).toMatch(/title="Inspect (Bow|Grenade|Mace|Sword|Spear|Gun \/ Rifle|Black Hole)"/)
	})

	it('renders working match-end destinations with final scores', () => {
		const ready = createSandboxScenario('infinity-beast-beatable').state
		const finished = applyGameAction(ready, {
			type: 'DEFEAT_MONSTER',
			playerId: 'player-1',
			monsterId: CORE_CATALOG.suddenDeathMonster.id,
		}).state
		const markup = renderToStaticMarkup(
			<GameBoard
				state={finished}
				localPlayerId="player-1"
				onAction={() => undefined}
				onPlayAgain={() => undefined}
				onReturnToMenu={() => undefined}
			/>,
		)
		expect(markup).toContain('Play again')
		expect(markup).toContain('Return to menu')
		expect(markup).toContain('Final score')
	})

	it('places the Draw deck before the arena cards and the Monster deck after them', () => {
		const state = createSandboxScenario('fresh-game').state
		const markup = renderToStaticMarkup(
			<GameBoard state={state} localPlayerId="player-1" onAction={() => undefined} />,
		)
		expect(markup.indexOf('Draw deck')).toBeLessThan(markup.indexOf('monster-row'))
		expect(markup.indexOf('Monster deck')).toBeGreaterThan(markup.indexOf('monster-row'))
		expect(markup).toContain(`Draw deck: ${state.drawPile.length} cards`)
		expect(markup).toContain(`Monster deck: ${state.monsterDeck.length} cards`)
	})
})
