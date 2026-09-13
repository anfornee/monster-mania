import {
	browserLocalPersistence,
	connectAuthEmulator,
	getAuth,
	setPersistence,
	signInAnonymously,
	type Auth,
} from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore'
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions'
import { getFirebaseApp } from './firebaseApp'

const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'
let authPromise: Promise<Auth> | null = null
let firestorePromise: Promise<Firestore> | null = null
let functionsPromise: Promise<Functions> | null = null

export function getMultiplayerAuth(): Promise<Auth> {
	authPromise ??= getFirebaseApp().then((app) => {
		const auth = getAuth(app)
		if (useEmulators) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
		return auth
	})
	return authPromise
}

export function getMultiplayerFirestore(): Promise<Firestore> {
	firestorePromise ??= getFirebaseApp().then((app) => {
		const firestore = getFirestore(app)
		if (useEmulators) connectFirestoreEmulator(firestore, '127.0.0.1', 8080)
		return firestore
	})
	return firestorePromise
}

export function getMultiplayerFunctions(): Promise<Functions> {
	functionsPromise ??= getFirebaseApp().then((app) => {
		const functions = getFunctions(app, 'us-central1')
		if (useEmulators) connectFunctionsEmulator(functions, '127.0.0.1', 5001)
		return functions
	})
	return functionsPromise
}

export async function signInWithPersistentAnonymousIdentity(auth: Auth): Promise<string> {
	await setPersistence(auth, browserLocalPersistence)
	const credential = await signInAnonymously(auth)
	return credential.user.uid
}
