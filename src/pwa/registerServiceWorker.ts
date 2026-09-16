import { registerSW } from 'virtual:pwa-register'

type UpdateListener = (updateAvailable: boolean) => void

const updateListeners = new Set<UpdateListener>()
let updateAvailable = false
let activateUpdate: () => Promise<void> = async () => undefined

function publishUpdateAvailable(available: boolean): void {
	updateAvailable = available
	for (const listener of updateListeners) listener(available)
}

export function subscribeToServiceWorkerUpdates(listener: UpdateListener): () => void {
	updateListeners.add(listener)
	listener(updateAvailable)
	return () => updateListeners.delete(listener)
}

export async function applyServiceWorkerUpdate(): Promise<void> {
	try {
		await activateUpdate()
		publishUpdateAvailable(false)
	} catch (error) {
		console.error('Monster Mania could not activate its updated offline cache.', error)
	}
}

export function registerServiceWorker(): void {
	if (!('serviceWorker' in navigator)) return
	const updateSW = registerSW({
		immediate: true,
		onNeedRefresh: () => publishUpdateAvailable(true),
		onRegisteredSW: (_url, registration) => {
			if (!registration) return
			const checkForUpdate = () => void registration.update().catch(() => undefined)
			window.setInterval(checkForUpdate, 60 * 60 * 1_000)
			document.addEventListener('visibilitychange', () => {
				if (!document.hidden) checkForUpdate()
			})
		},
		onRegisterError: (error) => {
			console.error('Monster Mania could not register its offline cache.', error)
		},
	})
	activateUpdate = () => updateSW(true)
}
