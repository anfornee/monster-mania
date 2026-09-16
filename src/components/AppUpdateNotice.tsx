import { useEffect, useState } from 'react'
import {
	applyServiceWorkerUpdate,
	subscribeToServiceWorkerUpdates,
} from '../pwa/registerServiceWorker'

export function AppUpdateNotice() {
	const [updateAvailable, setUpdateAvailable] = useState(false)
	useEffect(() => subscribeToServiceWorkerUpdates(setUpdateAvailable), [])
	if (!updateAvailable) return null
	return (
		<div className="app-update-notice" role="status">
			<span>A new tavern build is ready.</span>
			<button type="button" onClick={() => void applyServiceWorkerUpdate()}>Update now</button>
		</div>
	)
}
