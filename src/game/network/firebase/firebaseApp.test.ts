import { describe, expect, it, vi } from 'vitest'
import { FIREBASE_PROJECT_ID, resolveFirebaseOptions } from './firebaseApp'

const completeEnvironment = {
	VITE_FIREBASE_API_KEY: 'public-api-key',
	VITE_FIREBASE_AUTH_DOMAIN: `${FIREBASE_PROJECT_ID}.firebaseapp.com`,
	VITE_FIREBASE_PROJECT_ID: FIREBASE_PROJECT_ID,
	VITE_FIREBASE_STORAGE_BUCKET: `${FIREBASE_PROJECT_ID}.firebasestorage.app`,
	VITE_FIREBASE_MESSAGING_SENDER_ID: '223677909735',
	VITE_FIREBASE_APP_ID: '1:223677909735:web:test',
}

describe('Firebase Web app configuration', () => {
	it('uses a complete Vite environment without fetching Hosting configuration', async () => {
		const fetcher = vi.fn()
		const options = await resolveFirebaseOptions(completeEnvironment, fetcher)
		expect(options.projectId).toBe(FIREBASE_PROJECT_ID)
		expect(options.apiKey).toBe('public-api-key')
		expect(fetcher).not.toHaveBeenCalled()
	})

	it('falls back to the Firebase Hosting auto-configuration endpoint', async () => {
		const fetcher = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				apiKey: 'hosting-public-key',
				authDomain: `${FIREBASE_PROJECT_ID}.firebaseapp.com`,
				projectId: FIREBASE_PROJECT_ID,
				appId: 'hosting-app-id',
			}),
		})
		const options = await resolveFirebaseOptions({}, fetcher)
		expect(options.appId).toBe('hosting-app-id')
		expect(fetcher).toHaveBeenCalledWith('/__/firebase/init.json')
	})

	it('rejects incomplete or incorrectly targeted configuration', async () => {
		await expect(resolveFirebaseOptions({ VITE_FIREBASE_API_KEY: 'only-one-value' })).rejects.toThrow('incomplete')
		await expect(resolveFirebaseOptions({
			...completeEnvironment,
			VITE_FIREBASE_PROJECT_ID: 'another-project',
		})).rejects.toThrow('another-project')
	})
})
