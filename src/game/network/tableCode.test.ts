import { describe, expect, it } from 'vitest'
import {
	TABLE_CODE_LENGTH,
	createTableCode,
	isValidTableCode,
	normalizeTableCode,
} from './tableCode'

describe('Table codes', () => {
	it('creates short readable codes without ambiguous characters', () => {
		const code = createTableCode((values) => {
			values.set([0, 1, 2, 3, 4])
			return values
		})

		expect(code).toHaveLength(TABLE_CODE_LENGTH)
		expect(code).toBe('ABCDE')
		expect(isValidTableCode(code)).toBe(true)
		expect(code).not.toMatch(/[01IO]/)
	})

	it('normalizes case but rejects malformed input', () => {
		expect(normalizeTableCode(' ab7kq ')).toBe('AB7KQ')
		expect(isValidTableCode(' ab7kq ')).toBe(true)
		expect(isValidTableCode('AB-7KQ')).toBe(false)
		expect(isValidTableCode('SHORTER')).toBe(false)
	})
})
