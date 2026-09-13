import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { OnlineLobby } from './OnlineLobby'

describe('Online Table lobby', () => {
	it('offers create and join without exposing account concepts', () => {
		const markup = renderToStaticMarkup(<OnlineLobby initialPlayerName="Hunter" onBack={() => undefined} />)
		expect(markup).toContain('Create Table')
		expect(markup).toContain('Join Table')
		expect(markup).toContain('Hunter name')
		expect(markup).not.toMatch(/log in|sign in|account|password|email/i)
	})
})
