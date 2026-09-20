import { describe, expect, it } from 'vitest'
import { DEFAULT_TUTORIAL_PROGRESS } from './tutorialProgress'
import { getTutorialModeStatus, TUTORIAL_MODES } from './tutorialCatalog'

describe('tutorial mode catalog', () => {
	it('defines stable mode IDs and only exposes a playable Classic entry point', () => {
		expect(TUTORIAL_MODES.map((mode) => mode.id)).toEqual(['classic', 'ritual', 'chaos'])
		expect(TUTORIAL_MODES.filter((mode) => mode.availability === 'available').map((mode) => mode.id)).toEqual(['classic'])
		expect(TUTORIAL_MODES.find((mode) => mode.id === 'classic')?.tutorialEntryPoint).toBe('/tutorials/classic')
		expect(TUTORIAL_MODES.filter((mode) => mode.availability === 'coming-soon').every(
			(mode) => mode.tutorialEntryPoint === null && mode.lessons.length === 0,
		)).toBe(true)
	})

	it('reports availability and completion independently per mode', () => {
		const completed = structuredClone(DEFAULT_TUTORIAL_PROGRESS)
		completed.completed.classic = true

		expect(getTutorialModeStatus(TUTORIAL_MODES[0], completed)).toBe('completed')
		expect(getTutorialModeStatus(TUTORIAL_MODES[1], completed)).toBe('coming-soon')
		expect(getTutorialModeStatus(TUTORIAL_MODES[2], completed)).toBe('coming-soon')
	})
})
