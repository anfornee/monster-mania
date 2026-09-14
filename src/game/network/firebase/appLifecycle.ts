interface VisibilityTarget {
	visibilityState: DocumentVisibilityState
	addEventListener: (type: 'visibilitychange', listener: () => void) => void
	removeEventListener: (type: 'visibilitychange', listener: () => void) => void
}

interface PageShowTarget {
	addEventListener: (type: 'pageshow', listener: (event: PageTransitionEvent) => void) => void
	removeEventListener: (type: 'pageshow', listener: (event: PageTransitionEvent) => void) => void
}

export function subscribeToAppForeground(
	onForeground: () => void,
	visibilityTarget: VisibilityTarget = document,
	pageShowTarget: PageShowTarget = window,
): () => void {
	let wasHidden = visibilityTarget.visibilityState === 'hidden'
	const handleVisibilityChange = () => {
		const isHidden = visibilityTarget.visibilityState === 'hidden'
		if (wasHidden && !isHidden) onForeground()
		wasHidden = isHidden
	}
	const handlePageShow = (event: PageTransitionEvent) => {
		if (event.persisted) onForeground()
	}

	visibilityTarget.addEventListener('visibilitychange', handleVisibilityChange)
	pageShowTarget.addEventListener('pageshow', handlePageShow)
	return () => {
		visibilityTarget.removeEventListener('visibilitychange', handleVisibilityChange)
		pageShowTarget.removeEventListener('pageshow', handlePageShow)
	}
}
