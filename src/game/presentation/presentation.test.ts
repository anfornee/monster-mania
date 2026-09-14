import { describe, expect, it } from 'vitest'
import { createSandboxScenario } from '../sandbox/presets'
import { applyGameAction } from '../engine/applyGameAction'
import { getComputerActionDelay, GAME_TIMING } from './aiPacing'
import { getGameAnnouncement } from './announcements'
import { getActionPresentationSteps } from './presentationSequence'

describe('AI presentation pacing', () => {
	it('keeps announcements and opponent card reveals on screen long enough to read', () => {
		expect(GAME_TIMING.announcement).toBe(3450)
		expect(GAME_TIMING.opponentCardReveal).toBe(2625)
	})

	it('uses a longer thinking beat before shorter between-action beats', () => {
		const state = createSandboxScenario('fresh-game').state
		expect(getComputerActionDelay(state, true)).toBe(GAME_TIMING.aiThink)
		expect(getComputerActionDelay(state, false)).toBe(GAME_TIMING.aiBetweenActions)

		state.phase = 'forced-discard'
		expect(getComputerActionDelay(state, false)).toBeLessThan(GAME_TIMING.aiBetweenActions)
	})
})

describe('major game announcements', () => {
	it('selects Monster defeat details from a batch that also advances the turn', () => {
		const announcement = getGameAnnouncement([
			{ id: 7, type: 'monster-defeated', message: 'Rowan defeated Spikey for 2 points.' },
			{ id: 8, type: 'turn-started', message: "Mayhem Bot's turn began." },
		], 6)
		expect(announcement).toMatchObject({ title: 'Monster Defeated', subtitle: 'Spikey' })
	})

	it('prioritizes Sudden Death when the phase change shares an event batch', () => {
		const announcement = getGameAnnouncement([
			{ id: 12, type: 'monster-defeated', message: 'Rowan defeated Thing for 3 points.' },
			{ id: 13, type: 'sudden-death-started', message: 'The Infinity Beast enters the arena!' },
		], 11)
		expect(announcement).toMatchObject({ title: 'Sudden Death', tone: 'danger' })
	})
})

describe('accepted-action presentation sequence', () => {
	it('reveals an opponent Action before its resulting state is presented', () => {
		const before = structuredClone(createSandboxScenario('action-chain').state)
		const card = before.players[0].hand.find((candidate) => candidate.definitionId === 'draw-2')!
		before.players[0].hand = before.players[0].hand.filter((candidate) => candidate !== card)
		before.players[1].hand.push(card)
		before.turn.currentPlayerId = before.players[1].id
		const action = { type: 'PLAY_ACTION_CARD' as const, playerId: before.players[1].id, cardInstanceId: card.instanceId }
		const result = applyGameAction(before, action)
		expect(result.ok).toBe(true)
		expect(getActionPresentationSteps(before, result.state, action, before.players[0].id)).toMatchObject([
			{ type: 'opponent-card', card: { kind: 'played', cardDefinitionIds: ['draw-2'] } },
		])
	})

	it('reveals all opponent Weapons before a blocking defeat announcement', () => {
		const before = structuredClone(createSandboxScenario('beatable-monster').state)
		before.players[1].hand = before.players[0].hand
		before.players[0].hand = []
		before.turn.currentPlayerId = before.players[1].id
		const action = { type: 'DEFEAT_MONSTER' as const, playerId: before.players[1].id, monsterId: 'ground-worm' }
		const result = applyGameAction(before, action)
		expect(result.ok).toBe(true)
		const steps = getActionPresentationSteps(before, result.state, action, before.players[0].id)
		expect(steps.map((step) => step.type)).toEqual(['opponent-card', 'announcement'])
		expect(steps[0]).toMatchObject({
			card: { kind: 'played', cardDefinitionIds: ['grenade', 'gun', 'mace'] },
		})
	})

	it('reveals an opponent Ultimate Weapon through the same card step', () => {
		const before = structuredClone(createSandboxScenario('black-hole-ready').state)
		before.players[1].hand = before.players[0].hand
		before.players[0].hand = []
		before.turn.currentPlayerId = before.players[1].id
		const blackHole = before.players[1].hand.find((card) => card.definitionId === 'black-hole')!
		const action = {
			type: 'USE_ULTIMATE_WEAPON' as const,
			playerId: before.players[1].id,
			cardInstanceId: blackHole.instanceId,
			monsterId: 'thing',
		}
		const result = applyGameAction(before, action)
		expect(result.ok).toBe(true)
		expect(getActionPresentationSteps(before, result.state, action, before.players[0].id)[0]).toMatchObject({
			type: 'opponent-card',
			card: { kind: 'played', cardDefinitionIds: ['black-hole'] },
		})
	})

	it('reveals selected opponent discards before committing them', () => {
		const before = structuredClone(createSandboxScenario('fresh-game').state)
		const opponent = before.players[1]
		before.phase = 'forced-discard'
		before.turn.currentPlayerId = opponent.id
		before.turn.actionPhaseOpen = false
		before.pendingDiscard = {
			playerId: opponent.id,
			requiredCount: 1,
			selectedCardInstanceIds: [opponent.hand[0].instanceId],
			reason: 'action',
			remainingSetupPlayerIds: [],
		}
		const action = { type: 'CONFIRM_DISCARD' as const, playerId: opponent.id }
		const result = applyGameAction(before, action)
		expect(result.ok).toBe(true)
		expect(getActionPresentationSteps(before, result.state, action, before.players[0].id)[0]).toMatchObject({
			type: 'opponent-card',
			card: { kind: 'discarded', cardDefinitionIds: [opponent.hand[0].definitionId] },
		})
	})
})
