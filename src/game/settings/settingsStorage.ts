import { clampAudioBusVolume, type AudioBus } from '../audio/audioManifest'
import { AUDIO_ENABLED_STORAGE_KEY } from '../audio/audioPreference'

export const APP_SETTINGS_STORAGE_KEY = 'monster-mania:settings:v1'
export const APP_SETTINGS_VERSION = 1 as const

export interface AudioSettings {
	muted: boolean
	music: number
	ambience: number
	sfx: number
}

export interface AppSettings {
	version: typeof APP_SETTINGS_VERSION
	audio: AudioSettings
}

export interface SettingsStorage {
	getItem(key: string): string | null
	setItem(key: string, value: string): void
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
	version: APP_SETTINGS_VERSION,
	audio: {
		muted: false,
		music: 1,
		ambience: 1,
		sfx: 1,
	},
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function storedVolume(value: unknown, fallback: number): number {
	return typeof value === 'number' && Number.isFinite(value)
		? clampAudioBusVolume(value)
		: fallback
}

function loadLegacyMuted(storage: SettingsStorage): boolean {
	try {
		return storage.getItem(AUDIO_ENABLED_STORAGE_KEY) === 'false'
	} catch {
		return false
	}
}

export function loadAppSettings(storage: SettingsStorage): AppSettings {
	const legacyMuted = loadLegacyMuted(storage)
	try {
		const stored = storage.getItem(APP_SETTINGS_STORAGE_KEY)
		if (!stored) {
			return {
				...DEFAULT_APP_SETTINGS,
				audio: { ...DEFAULT_APP_SETTINGS.audio, muted: legacyMuted },
			}
		}
		const parsed: unknown = JSON.parse(stored)
		if (!isRecord(parsed) || parsed.version !== APP_SETTINGS_VERSION || !isRecord(parsed.audio)) {
			return {
				...DEFAULT_APP_SETTINGS,
				audio: { ...DEFAULT_APP_SETTINGS.audio, muted: legacyMuted },
			}
		}
		return {
			version: APP_SETTINGS_VERSION,
			audio: {
				muted: typeof parsed.audio.muted === 'boolean' ? parsed.audio.muted : legacyMuted,
				music: storedVolume(parsed.audio.music, DEFAULT_APP_SETTINGS.audio.music),
				ambience: storedVolume(parsed.audio.ambience, DEFAULT_APP_SETTINGS.audio.ambience),
				sfx: storedVolume(parsed.audio.sfx, DEFAULT_APP_SETTINGS.audio.sfx),
			},
		}
	} catch {
		return {
			...DEFAULT_APP_SETTINGS,
			audio: { ...DEFAULT_APP_SETTINGS.audio, muted: legacyMuted },
		}
	}
}

export function saveAppSettings(storage: SettingsStorage, settings: AppSettings): void {
	try {
		storage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
	} catch {
		// Settings remain active for this visit when persistent storage is unavailable.
	}
}

export function updateAudioSettings(
	settings: AppSettings,
	update: Partial<AudioSettings>,
): AppSettings {
	return {
		...settings,
		audio: {
			muted: typeof update.muted === 'boolean' ? update.muted : settings.audio.muted,
			music: update.music === undefined
				? settings.audio.music
				: clampAudioBusVolume(update.music),
			ambience: update.ambience === undefined
				? settings.audio.ambience
				: clampAudioBusVolume(update.ambience),
			sfx: update.sfx === undefined
				? settings.audio.sfx
				: clampAudioBusVolume(update.sfx),
		},
	}
}

export function getAudioBusSettings(settings: AppSettings): Record<AudioBus, number> {
	return {
		music: settings.audio.music,
		ambience: settings.audio.ambience,
		sfx: settings.audio.sfx,
	}
}
