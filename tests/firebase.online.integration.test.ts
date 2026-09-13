import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { GameAction } from '../src/game/engine/types'
import { FirestoreTableClient } from '../src/game/network/firebase/firestoreTableClient'
import type { OnlineGameSnapshot } from '../src/game/network/onlineGame'

const describeWithEmulators = process.env.FIREBASE_EMULATOR_HUB ? describe : describe.skip
const PROJECT_ID = 'monster-mania-aea35'

function nextGame(
	client: FirestoreTableClient,
	tableId: string,
	uid: string,
	revision: number,
): Promise<OnlineGameSnapshot> {
	return new Promise((resolve, reject) => {
		let unsubscribe = () => {}
		unsubscribe = client.watchGame(tableId, uid, (snapshot) => {
			if (snapshot.revision !== revision) return
			unsubscribe()
			resolve(snapshot)
		}, reject)
	})
}

describeWithEmulators('Firebase callable Online Table', () => {
	const apps: FirebaseApp[] = []
	let hostUid: string
	let guestUid: string
	let hostClient: FirestoreTableClient
	let guestClient: FirestoreTableClient

	beforeAll(async () => {
		const createClient = async (name: string) => {
			const app = initializeApp({ projectId: PROJECT_ID, apiKey: 'emulator-key' }, name)
			apps.push(app)
			const auth = getAuth(app)
			const firestore = getFirestore(app)
			const functions = getFunctions(app, 'us-central1')
			connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
			connectFirestoreEmulator(firestore, '127.0.0.1', 8080)
			connectFunctionsEmulator(functions, '127.0.0.1', 5001)
			const credential = await signInAnonymously(auth)
			return {
				uid: credential.user.uid,
				client: new FirestoreTableClient(firestore, {
					functions,
					createCode: () => 'KM7PQ',
				}),
			}
		}
		const [host, guest] = await Promise.all([
			createClient('online-host'),
			createClient('online-guest'),
		])
		hostUid = host.uid
		guestUid = guest.uid
		hostClient = host.client
		guestClient = guest.client
	})

	afterAll(async () => {
		await Promise.all(apps.map(deleteApp))
	})

	it('authenticates, initializes once, and synchronizes one action from each player', async () => {
		const created = await hostClient.createTable(hostUid, 'Player A')
		await guestClient.joinTable(guestUid, 'Player B', created.table.joinCode)
		const [hostInitialization, guestInitialization] = await Promise.all([
			hostClient.initializeGame(created.table.id),
			guestClient.initializeGame(created.table.id),
		])
		expect(hostInitialization).toBe(0)
		expect(guestInitialization).toBe(0)

		const [hostInitial, guestInitial] = await Promise.all([
			nextGame(hostClient, created.table.id, hostUid, 0),
			nextGame(guestClient, created.table.id, guestUid, 0),
		])
		expect(hostInitial.state.players.find((player) => player.id === hostUid)?.hand)
			.toHaveLength(3)
		expect(guestInitial.state.players.find((player) => player.id === guestUid)?.hand)
			.toHaveLength(3)
		expect(hostInitial.state.players.find((player) => player.id === guestUid)?.hand)
			.toSatisfy((hand: Array<{ definitionId: string }>) => hand.every((card) => card.definitionId === 'hidden'))
		expect(guestInitial.state.players.find((player) => player.id === hostUid)?.hand)
			.toSatisfy((hand: Array<{ definitionId: string }>) => hand.every((card) => card.definitionId === 'hidden'))

		const firstActor = hostInitial.state.turn.currentPlayerId
		const firstClient = firstActor === hostUid ? hostClient : guestClient
		const firstObserver = firstActor === hostUid ? guestClient : hostClient
		const firstObserverUid = firstActor === hostUid ? guestUid : hostUid
		const firstUpdate = nextGame(firstObserver, created.table.id, firstObserverUid, 1)
		const firstAction: GameAction = { type: 'SKIP_TURN', playerId: firstActor }
		await expect(firstClient.submitAction(created.table.id, 0, firstAction)).resolves.toBe(1)
		const afterFirst = await firstUpdate

		const secondActor = afterFirst.state.turn.currentPlayerId
		expect(secondActor).not.toBe(firstActor)
		const secondClient = secondActor === hostUid ? hostClient : guestClient
		const secondObserver = secondActor === hostUid ? guestClient : hostClient
		const secondObserverUid = secondActor === hostUid ? guestUid : hostUid
		const secondUpdate = nextGame(secondObserver, created.table.id, secondObserverUid, 2)
		const secondAction: GameAction = { type: 'SKIP_TURN', playerId: secondActor }
		await expect(secondClient.submitAction(created.table.id, 1, secondAction)).resolves.toBe(2)
		await expect(secondUpdate).resolves.toMatchObject({ revision: 2 })
	}, 30_000)
})
