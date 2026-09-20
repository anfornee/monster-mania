import { describe, expect, it } from 'vitest'
import { AUDIO_ENABLED_STORAGE_KEY } from '../audio/audioPreference'
import {
	APP_SETTINGS_STORAGE_KEY,
	DEFAULT_APP_SETTINGS,
	loadAppSettings,
	saveAppSettings,
	updateAudioSettings,
	type SettingsStorage,
} from './settingsStorage'

class MemoryStorage implements SettingsStorage {
	private readonly values = new Map<string, string>()

	getItem(key: string): string | null {
		return this.values.get(key) ?? null
	}

	setItem(key: string, value: string): void {
		this.values.set(key, value)
	}
}

describe('app settings storage', () => {
	it('defaults first-time users to unmuted authored audio levels', () => {
		expect(loadAppSettings(new MemoryStorage())).toEqual(DEFAULT_APP_SETTINGS)
	})

	it('persists and restores every audio preference', () => {
		const storage = new MemoryStorage()
		const settings = updateAudioSettings(DEFAULT_APP_SETTINGS, {
			muted: true,
			music: .6,
			ambience: .4,
			sfx: .9,
		})
		saveAppSettings(storage, settings)
		expect(loadAppSettings(storage)).toEqual(settings)
	})

	it('falls back safely when stored settings are malformed or unsupported', () => {
		const storage = new MemoryStorage()
		storage.setItem(APP_SETTINGS_STORAGE_KEY, '{broken')
		expect(loadAppSettings(storage)).toEqual(DEFAULT_APP_SETTINGS)
		storage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify({ version: 99, audio: {} }))
		expect(loadAppSettings(storage)).toEqual(DEFAULT_APP_SETTINGS)
	})

	it('migrates the legacy disabled preference into master mute', () => {
		const storage = new MemoryStorage()
		storage.setItem(AUDIO_ENABLED_STORAGE_KEY, 'false')
		expect(loadAppSettings(storage).audio).toEqual({
			muted: true,
			music: 1,
			ambience: 1,
			sfx: 1,
		})
	})

	it('preserves bus levels across master mute and changes buses independently', () => {
		const mixed = updateAudioSettings(DEFAULT_APP_SETTINGS, {
			music: .6,
			ambience: .4,
			sfx: .9,
		})
		const muted = updateAudioSettings(mixed, { muted: true })
		const restored = updateAudioSettings(muted, { muted: false })
		expect(restored.audio).toEqual(mixed.audio)
		expect(updateAudioSettings(restored, { music: .2 }).audio).toEqual({
			...restored.audio,
			music: .2,
		})
	})

	it('clamps persisted bus values without amplifying authored audio', () => {
		const storage = new MemoryStorage()
		storage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify({
			version: 1,
			audio: { muted: false, music: 4, ambience: -.5, sfx: .25 },
		}))
		expect(loadAppSettings(storage).audio).toEqual({
			muted: false,
			music: 1,
			ambience: 0,
			sfx: .25,
		})
	})
})
