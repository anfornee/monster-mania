import { registerSW } from 'virtual:pwa-register'

export function registerServiceWorker(): void {
	if (!('serviceWorker' in navigator)) return
	registerSW({
		immediate: true,
		onRegisterError: (error) => {
			console.error('Monster Mania could not register its offline cache.', error)
		},
	})
}
