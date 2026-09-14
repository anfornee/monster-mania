import { describe, expect, it, vi } from 'vitest'
import { withOnlineRequestTimeout } from './onlineRequestTimeout'

describe('Online Table request timeout', () => {
	it('returns a completed request and clears its timeout', async () => {
		vi.useFakeTimers()
		await expect(withOnlineRequestTimeout(Promise.resolve('ready'), 'Timed out.', 100)).resolves.toBe('ready')
		vi.runAllTimers()
		vi.useRealTimers()
	})

	it('rejects a silently stalled request with a recoverable Online Table error', async () => {
		vi.useFakeTimers()
		const result = withOnlineRequestTimeout(new Promise(() => undefined), 'Joining timed out.', 100)
		const expectation = expect(result).rejects.toMatchObject({
			code: 'FIREBASE_UNAVAILABLE',
			message: 'Joining timed out.',
		})
		await vi.advanceTimersByTimeAsync(100)
		await expectation
		vi.useRealTimers()
	})
})
