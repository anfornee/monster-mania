import { getMultiplayerAuth, signInWithPersistentAnonymousIdentity } from './firebaseServices'

export interface MultiplayerIdentity {
	uid: string
}

export interface MultiplayerIdentityAdapter {
	waitUntilReady: () => Promise<void>
	currentUid: () => string | null
	signIn: () => Promise<string>
}

async function firebaseIdentityAdapter(): Promise<MultiplayerIdentityAdapter> {
	const auth = await getMultiplayerAuth()
	return {
		waitUntilReady: () => auth.authStateReady(),
		currentUid: () => auth.currentUser?.uid ?? null,
		signIn: () => signInWithPersistentAnonymousIdentity(auth),
	}
}

export async function ensureMultiplayerIdentity(
	adapter?: MultiplayerIdentityAdapter,
): Promise<MultiplayerIdentity> {
	const identityAdapter = adapter ?? await firebaseIdentityAdapter()
	await identityAdapter.waitUntilReady()
	const existingUid = identityAdapter.currentUid()
	return { uid: existingUid ?? await identityAdapter.signIn() }
}
