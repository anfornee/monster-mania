import { describe, expect, it } from 'vitest'
import { createSandboxScenario } from '../sandbox/presets'
import { getComputerActionDelay, GAME_TIMING } from './aiPacing'
import { getGameAnnouncement } from './announcements'

describe('AI presentation pacing', () => {
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
