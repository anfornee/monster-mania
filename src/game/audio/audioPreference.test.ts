import { describe, expect, it } from 'vitest'
import {
	AUDIO_ENABLED_STORAGE_KEY,
	loadAudioEnabled,
	saveAudioEnabled,
	type AudioPreferenceStorage,
} from './audioPreference'

class MemoryStorage implements AudioPreferenceStorage {
	private readonly values = new Map<string, string>()

	getItem(key: string): string | null {
		return this.values.get(key) ?? null
	}

	setItem(key: string, value: string): void {
		this.values.set(key, value)
	}
}

describe('audio preference', () => {
	it('defaults new users to sound enabled', () => {
		expect(loadAudioEnabled(new MemoryStorage())).toBe(true)
	})

	it('persists and restores both muted and enabled states', () => {
		const storage = new MemoryStorage()
		saveAudioEnabled(storage, false)
		expect(storage.getItem(AUDIO_ENABLED_STORAGE_KEY)).toBe('false')
		expect(loadAudioEnabled(storage)).toBe(false)
		saveAudioEnabled(storage, true)
		expect(loadAudioEnabled(storage)).toBe(true)
	})

	it('falls back to enabled when storage is unavailable', () => {
		const broken: AudioPreferenceStorage = {
			getItem: () => { throw new Error('blocked') },
			setItem: () => { throw new Error('blocked') },
		}
		expect(loadAudioEnabled(broken)).toBe(true)
		expect(() => saveAudioEnabled(broken, false)).not.toThrow()
	})
})
