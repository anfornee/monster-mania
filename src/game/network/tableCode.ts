export const TABLE_CODE_LENGTH = 5

// Ambiguous characters such as O/0 and I/1 are intentionally omitted.
const TABLE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export type FillRandomValues = (values: Uint32Array<ArrayBuffer>) => void

function secureRandomValues(values: Uint32Array<ArrayBuffer>): void {
	globalThis.crypto.getRandomValues(values)
}

export function createTableCode(
	fillRandomValues: FillRandomValues = secureRandomValues,
): string {
	const values = new Uint32Array(TABLE_CODE_LENGTH)
	fillRandomValues(values)
	return Array.from(
		values,
		(value) => TABLE_CODE_ALPHABET[value % TABLE_CODE_ALPHABET.length],
	).join('')
}

export function normalizeTableCode(value: string): string {
	return value.trim().toUpperCase()
}

export function isValidTableCode(value: string): boolean {
	return new RegExp(`^[${TABLE_CODE_ALPHABET}]{${TABLE_CODE_LENGTH}}$`).test(
		normalizeTableCode(value),
	)
}
