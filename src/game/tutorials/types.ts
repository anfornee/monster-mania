import type { GameAction } from '../engine/types'

export type TutorialModeId = 'classic' | 'ritual' | 'chaos'

export type TutorialModeAvailability = 'available' | 'coming-soon'

export interface TutorialActionRequirement {
	type: GameAction['type']
	cardDefinitionId?: string
	monsterId?: string
}

export interface TutorialLessonDefinition {
	id: string
	title: string
	instruction: string
	hint: string
	requiredAction: TutorialActionRequirement | null
	followUpActions?: readonly GameAction[]
}

export interface TutorialModeDefinition {
	id: TutorialModeId
	displayName: string
	description: string
	availability: TutorialModeAvailability
	tutorialEntryPoint: string | null
	lessons: readonly TutorialLessonDefinition[]
}

export interface TutorialProgress {
	version: 1
	completed: Record<TutorialModeId, boolean>
}

export type TutorialModeStatus = 'not-started' | 'completed' | 'coming-soon'
