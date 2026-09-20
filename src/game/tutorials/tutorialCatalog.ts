import { CLASSIC_TUTORIAL_LESSONS } from './classicTutorial'
import type {
	TutorialModeDefinition,
	TutorialModeId,
	TutorialModeStatus,
	TutorialProgress,
} from './types'

export const TUTORIAL_MODES = [
	{
		id: 'classic',
		displayName: 'Classic',
		description: 'Learn the standard Monster Mania hunt: play Actions, build Weapon sets, defeat Monsters, and score points.',
		availability: 'available',
		tutorialEntryPoint: '/tutorials/classic',
		lessons: CLASSIC_TUTORIAL_LESSONS,
	},
	{
		id: 'ritual',
		displayName: 'Ritual',
		description: 'Training for the future Ritual game mode will arrive after its rules are finalized.',
		availability: 'coming-soon',
		tutorialEntryPoint: null,
		lessons: [],
	},
	{
		id: 'chaos',
		displayName: 'Chaos',
		description: 'Training for the future Chaos game mode will arrive after its rules are finalized.',
		availability: 'coming-soon',
		tutorialEntryPoint: null,
		lessons: [],
	},
] as const satisfies readonly TutorialModeDefinition[]

export function getTutorialMode(modeId: TutorialModeId): TutorialModeDefinition {
	return TUTORIAL_MODES.find((mode) => mode.id === modeId)!
}

export function getTutorialModeStatus(
	mode: TutorialModeDefinition,
	progress: TutorialProgress,
): TutorialModeStatus {
	if (mode.availability === 'coming-soon') return 'coming-soon'
	return progress.completed[mode.id] ? 'completed' : 'not-started'
}
