export const PLAYER_NAME_STORAGE_KEY = 'monster-mania:player-name:v1'
export const PLAYER_NAME_MAX_LENGTH = 24
export const DEFAULT_PLAYER_NAME = 'Hunter'

export interface BrowserStorage {
	getItem(key: string): string | null
	setItem(key: string, value: string): void
}

export function normalizePlayerName(value: string): string {
	return value.trim().replace(/\s+/g, ' ').slice(0, PLAYER_NAME_MAX_LENGTH)
}

export function validatePlayerName(value: string): string | null {
	const normalized = normalizePlayerName(value)
	if (!normalized) return 'Enter a name before starting the match.'
	if (normalized.length < 2) return 'Use at least 2 characters.'
	return null
}

export function loadPlayerName(storage: BrowserStorage): string {
	try {
		const storedName = storage.getItem(PLAYER_NAME_STORAGE_KEY)
		return storedName && !validatePlayerName(storedName)
			? normalizePlayerName(storedName)
			: DEFAULT_PLAYER_NAME
	} catch {
		return DEFAULT_PLAYER_NAME
	}
}

export function savePlayerName(storage: BrowserStorage, value: string): string {
	const normalized = normalizePlayerName(value)
	if (validatePlayerName(normalized)) return DEFAULT_PLAYER_NAME
	try {
		storage.setItem(PLAYER_NAME_STORAGE_KEY, normalized)
	} catch {
		// A blocked storage API should not prevent a local match.
	}
	return normalized
}
