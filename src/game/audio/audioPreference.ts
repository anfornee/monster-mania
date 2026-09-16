export const AUDIO_ENABLED_STORAGE_KEY = 'monster-mania:audio-enabled:v1'

export interface AudioPreferenceStorage {
	getItem(key: string): string | null
	setItem(key: string, value: string): void
}

export function loadAudioEnabled(storage: AudioPreferenceStorage): boolean {
	try {
		return storage.getItem(AUDIO_ENABLED_STORAGE_KEY) !== 'false'
	} catch {
		return true
	}
}

export function saveAudioEnabled(storage: AudioPreferenceStorage, enabled: boolean): void {
	try {
		storage.setItem(AUDIO_ENABLED_STORAGE_KEY, String(enabled))
	} catch {
		// Audio remains usable for this visit when persistent storage is unavailable.
	}
}
