import { describe, expect, it } from 'vitest'
import {
	completeTutorialMode,
	DEFAULT_TUTORIAL_PROGRESS,
	loadTutorialProgress,
	saveTutorialProgress,
	TUTORIAL_PROGRESS_STORAGE_KEY,
	type TutorialProgressStorage,
} from './tutorialProgress'

class MemoryStorage implements TutorialProgressStorage {
	private value: string | null = null

	getItem(key: string): string | null {
		return key === TUTORIAL_PROGRESS_STORAGE_KEY ? this.value : null
	}

	setItem(key: string, value: string): void {
		if (key === TUTORIAL_PROGRESS_STORAGE_KEY) this.value = value
	}
}

describe('tutorial progress', () => {
	it('defaults safely and stores completion independently by mode', () => {
		const storage = new MemoryStorage()
		const initial = loadTutorialProgress(storage)
		const completed = completeTutorialMode(initial, 'classic')
		saveTutorialProgress(storage, completed)

		expect(loadTutorialProgress(storage)).toEqual({
			version: 1,
			completed: { classic: true, ritual: false, chaos: false },
		})
		expect(initial).toEqual(DEFAULT_TUTORIAL_PROGRESS)
	})

	it('falls back for malformed or unsupported stored data', () => {
		const storage = new MemoryStorage()
		storage.setItem(TUTORIAL_PROGRESS_STORAGE_KEY, '{broken')
		expect(loadTutorialProgress(storage)).toEqual(DEFAULT_TUTORIAL_PROGRESS)
		storage.setItem(TUTORIAL_PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, completed: {} }))
		expect(loadTutorialProgress(storage)).toEqual(DEFAULT_TUTORIAL_PROGRESS)
	})
})
