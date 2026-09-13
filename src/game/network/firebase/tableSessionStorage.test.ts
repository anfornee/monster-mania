import { describe, expect, it } from 'vitest'
import {
	clearOnlineTableSession,
	loadOnlineTableSession,
	ONLINE_TABLE_SESSION_KEY,
	saveOnlineTableSession,
} from './tableSessionStorage'

function memoryStorage(initialValue: string | null = null) {
	let value = initialValue
	return {
		getItem: () => value,
		setItem: (_key: string, nextValue: string) => { value = nextValue },
		removeItem: () => { value = null },
		value: () => value,
	}
}

describe('Online Table session storage', () => {
	it('stores and restores a normalized Table reference', () => {
		const storage = memoryStorage()
		saveOnlineTableSession(storage, { tableId: 'table-1', joinCode: 'AB7KQ' })
		expect(loadOnlineTableSession(storage)).toEqual({ tableId: 'table-1', joinCode: 'AB7KQ' })
		expect(storage.value()).toContain('table-1')
	})

	it('ignores malformed data and can forget the local reference', () => {
		const malformed = memoryStorage('{broken')
		expect(loadOnlineTableSession(malformed)).toBeNull()

		const storage = memoryStorage(JSON.stringify({ tableId: 'table-1', joinCode: 'AB7KQ' }))
		clearOnlineTableSession(storage)
		expect(storage.value()).toBeNull()
		expect(ONLINE_TABLE_SESSION_KEY).toBe('monster-mania:online-table:v1')
	})
})
