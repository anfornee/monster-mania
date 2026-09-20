import type { TutorialModeId, TutorialProgress } from './types'

export const TUTORIAL_PROGRESS_STORAGE_KEY = 'monster-mania:tutorial-progress:v1'

export interface TutorialProgressStorage {
	getItem(key: string): string | null
	setItem(key: string, value: string): void
}

export const DEFAULT_TUTORIAL_PROGRESS: TutorialProgress = {
	version: 1,
	completed: {
		classic: false,
		ritual: false,
		chaos: false,
	},
}

export function loadTutorialProgress(storage: TutorialProgressStorage): TutorialProgress {
	try {
		const value = storage.getItem(TUTORIAL_PROGRESS_STORAGE_KEY)
		if (!value) return structuredClone(DEFAULT_TUTORIAL_PROGRESS)
		const parsed = JSON.parse(value) as Partial<TutorialProgress>
		if (parsed.version !== 1 || !parsed.completed || typeof parsed.completed !== 'object') {
			return structuredClone(DEFAULT_TUTORIAL_PROGRESS)
		}
		return {
			version: 1,
			completed: {
				classic: parsed.completed.classic === true,
				ritual: parsed.completed.ritual === true,
				chaos: parsed.completed.chaos === true,
			},
		}
	} catch {
		return structuredClone(DEFAULT_TUTORIAL_PROGRESS)
	}
}

export function saveTutorialProgress(
	storage: TutorialProgressStorage,
	progress: TutorialProgress,
): void {
	try {
		storage.setItem(TUTORIAL_PROGRESS_STORAGE_KEY, JSON.stringify(progress))
	} catch {
		// Completion remains informational for this visit when storage is unavailable.
	}
}

export function completeTutorialMode(
	progress: TutorialProgress,
	modeId: TutorialModeId,
): TutorialProgress {
	return {
		version: 1,
		completed: {
			...progress.completed,
			[modeId]: true,
		},
	}
}
