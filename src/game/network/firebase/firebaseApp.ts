import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app'

export const FIREBASE_PROJECT_ID = 'monster-mania-aea35'

interface FirebaseEnvironment {
	VITE_FIREBASE_API_KEY?: string
	VITE_FIREBASE_AUTH_DOMAIN?: string
	VITE_FIREBASE_PROJECT_ID?: string
	VITE_FIREBASE_STORAGE_BUCKET?: string
	VITE_FIREBASE_MESSAGING_SENDER_ID?: string
	VITE_FIREBASE_APP_ID?: string
}

type ConfigFetcher = (input: RequestInfo | URL) => Promise<Pick<Response, 'ok' | 'json'>>

function optionsFromEnvironment(environment: FirebaseEnvironment): FirebaseOptions | null {
	const values = [
		environment.VITE_FIREBASE_API_KEY,
		environment.VITE_FIREBASE_AUTH_DOMAIN,
		environment.VITE_FIREBASE_PROJECT_ID,
		environment.VITE_FIREBASE_STORAGE_BUCKET,
		environment.VITE_FIREBASE_MESSAGING_SENDER_ID,
		environment.VITE_FIREBASE_APP_ID,
	]
	if (values.every((value) => !value)) return null
	if (values.some((value) => !value)) {
		throw new Error('Firebase configuration is incomplete. Copy every VITE_FIREBASE_* value from .env.example.')
	}
	return {
		apiKey: environment.VITE_FIREBASE_API_KEY,
		authDomain: environment.VITE_FIREBASE_AUTH_DOMAIN,
		projectId: environment.VITE_FIREBASE_PROJECT_ID,
		storageBucket: environment.VITE_FIREBASE_STORAGE_BUCKET,
		messagingSenderId: environment.VITE_FIREBASE_MESSAGING_SENDER_ID,
		appId: environment.VITE_FIREBASE_APP_ID,
	}
}

function validateFirebaseOptions(options: FirebaseOptions): FirebaseOptions {
	if (!options.apiKey || !options.authDomain || !options.appId || !options.projectId) {
		throw new Error('The Firebase Web app configuration is missing required fields.')
	}
	if (options.projectId !== FIREBASE_PROJECT_ID) {
		throw new Error(`Firebase configuration targets ${options.projectId}, not ${FIREBASE_PROJECT_ID}.`)
	}
	return options
}

export async function resolveFirebaseOptions(
	environment: FirebaseEnvironment,
	fetcher: ConfigFetcher = fetch,
): Promise<FirebaseOptions> {
	const environmentOptions = optionsFromEnvironment(environment)
	if (environmentOptions) return validateFirebaseOptions(environmentOptions)

	const response = await fetcher('/__/firebase/init.json')
	if (!response.ok) {
		throw new Error('Firebase is not configured for this environment. Copy .env.example to .env.local.')
	}
	return validateFirebaseOptions(await response.json() as FirebaseOptions)
}

let appPromise: Promise<FirebaseApp> | null = null

export function getFirebaseApp(): Promise<FirebaseApp> {
	if (getApps().length > 0) return Promise.resolve(getApp())
	appPromise ??= resolveFirebaseOptions(import.meta.env as FirebaseEnvironment).then((options) => initializeApp(options))
	return appPromise
}
