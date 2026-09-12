import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GameBootScreen } from './GameBootScreen'

describe('GameBootScreen', () => {
	it('shows real progress without making every percentage a live announcement', () => {
		const markup = renderToStaticMarkup(
			<GameBootScreen
				status="loading"
				progress={{ total: 4, completed: 3, failed: 0, percent: 75 }}
				leaving={false}
				onRetry={() => undefined}
			/>,
		)
		expect(markup).toContain('Loading <strong>75%</strong>')
		expect(markup).toContain('Lighting the tavern.')
		expect(markup.match(/aria-live="polite"/g)).toHaveLength(1)
	})

	it('offers a retry for critical failures', () => {
		const markup = renderToStaticMarkup(
			<GameBootScreen
				status="error"
				progress={{ total: 2, completed: 2, failed: 1, percent: 100 }}
				leaving={false}
				onRetry={() => undefined}
			/>,
		)
		expect(markup).toContain('Something failed to load.')
		expect(markup).toContain('Retry')
		expect(markup).toContain('role="alert"')
	})
})
