import { isValidTableCode, normalizeTableCode } from '../tableCode'

export const ONLINE_TABLE_SESSION_KEY = 'monster-mania:online-table:v1'

export interface StoredOnlineTableSession {
	tableId: string
	joinCode: string
}

export function loadOnlineTableSession(storage: Pick<Storage, 'getItem'>): StoredOnlineTableSession | null {
	try {
		const value = storage.getItem(ONLINE_TABLE_SESSION_KEY)
		if (!value) return null
		const parsed = JSON.parse(value) as Partial<StoredOnlineTableSession>
		if (typeof parsed.tableId !== 'string' || !parsed.tableId || typeof parsed.joinCode !== 'string') return null
		const joinCode = normalizeTableCode(parsed.joinCode)
		return isValidTableCode(joinCode) ? { tableId: parsed.tableId, joinCode } : null
	} catch {
		return null
	}
}

export function saveOnlineTableSession(
	storage: Pick<Storage, 'setItem'>,
	session: StoredOnlineTableSession,
): void {
	storage.setItem(ONLINE_TABLE_SESSION_KEY, JSON.stringify(session))
}

export function clearOnlineTableSession(storage: Pick<Storage, 'removeItem'>): void {
	storage.removeItem(ONLINE_TABLE_SESSION_KEY)
}
