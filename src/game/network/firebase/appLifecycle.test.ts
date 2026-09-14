import { describe, expect, it, vi } from 'vitest'
import { subscribeToAppForeground } from './appLifecycle'

class VisibilityHarness extends EventTarget {
	visibilityState: DocumentVisibilityState = 'visible'
}

describe('Online Table app lifecycle', () => {
	it('requests a reconnect after returning from the background', () => {
		const visibility = new VisibilityHarness()
		const page = new EventTarget()
		const onForeground = vi.fn()
		const unsubscribe = subscribeToAppForeground(onForeground, visibility, page)

		visibility.visibilityState = 'hidden'
		visibility.dispatchEvent(new Event('visibilitychange'))
		visibility.visibilityState = 'visible'
		visibility.dispatchEvent(new Event('visibilitychange'))
		expect(onForeground).toHaveBeenCalledOnce()

		unsubscribe()
		visibility.visibilityState = 'hidden'
		visibility.dispatchEvent(new Event('visibilitychange'))
		visibility.visibilityState = 'visible'
		visibility.dispatchEvent(new Event('visibilitychange'))
		expect(onForeground).toHaveBeenCalledOnce()
	})

	it('requests a reconnect when restoring a page from the back-forward cache', () => {
		const visibility = new VisibilityHarness()
		const page = new EventTarget()
		const onForeground = vi.fn()
		subscribeToAppForeground(onForeground, visibility, page)

		const event = new Event('pageshow') as PageTransitionEvent
		Object.defineProperty(event, 'persisted', { value: true })
		page.dispatchEvent(event)

		expect(onForeground).toHaveBeenCalledOnce()
	})
})
