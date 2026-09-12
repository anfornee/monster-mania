import { describe, expect, it } from 'vitest'
import {
	DEFAULT_PLAYER_NAME,
	loadPlayerName,
	normalizePlayerName,
	PLAYER_NAME_MAX_LENGTH,
	PLAYER_NAME_STORAGE_KEY,
	savePlayerName,
	validatePlayerName,
} from './playerProfile'

function memoryStorage(initialValue: string | null = null) {
	let value = initialValue
	return {
		getItem: (key: string) => key === PLAYER_NAME_STORAGE_KEY ? value : null,
		setItem: (key: string, nextValue: string) => {
			if (key === PLAYER_NAME_STORAGE_KEY) value = nextValue
		},
		read: () => value,
	}
}

describe('player profile', () => {
	it('trims and collapses whitespace for grammatical narration', () => {
		expect(normalizePlayerName('  Anthony   Hunter  ')).toBe('Anthony Hunter')
		expect(validatePlayerName('  ')).toMatch(/Enter a name/)
		expect(validatePlayerName('A')).toMatch(/at least 2/)
	})

	it('enforces the documented maximum length', () => {
		expect(normalizePlayerName('x'.repeat(PLAYER_NAME_MAX_LENGTH + 8))).toHaveLength(PLAYER_NAME_MAX_LENGTH)
	})

	it('persists a valid name and safely falls back for invalid storage', () => {
		const storage = memoryStorage()
		expect(savePlayerName(storage, '  Rowan  ')).toBe('Rowan')
		expect(storage.read()).toBe('Rowan')
		expect(loadPlayerName(storage)).toBe('Rowan')
		expect(loadPlayerName(memoryStorage(' '))).toBe(DEFAULT_PLAYER_NAME)
	})
})
