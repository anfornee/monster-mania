import { describe, expect, it, vi } from 'vitest'
import { ensureMultiplayerIdentity, type MultiplayerIdentityAdapter } from './multiplayerIdentity'

function adapter(currentUid: string | null): MultiplayerIdentityAdapter {
	return {
		waitUntilReady: vi.fn().mockResolvedValue(undefined),
		currentUid: vi.fn().mockReturnValue(currentUid),
		signIn: vi.fn().mockResolvedValue('anonymous-new'),
	}
}

describe('multiplayer identity', () => {
	it('restores the existing persistent anonymous identity', async () => {
		const existing = adapter('anonymous-existing')
		await expect(ensureMultiplayerIdentity(existing)).resolves.toEqual({ uid: 'anonymous-existing' })
		expect(existing.waitUntilReady).toHaveBeenCalledOnce()
		expect(existing.signIn).not.toHaveBeenCalled()
	})

	it('signs in anonymously only when no identity exists', async () => {
		const missing = adapter(null)
		await expect(ensureMultiplayerIdentity(missing)).resolves.toEqual({ uid: 'anonymous-new' })
		expect(missing.signIn).toHaveBeenCalledOnce()
	})
})
