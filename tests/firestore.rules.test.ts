import { readFileSync } from 'node:fs'
import {
	assertFails,
	assertSucceeds,
	initializeTestEnvironment,
	type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, type Firestore } from 'firebase/firestore'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { FirestoreTableClient } from '../src/game/network/firebase/firestoreTableClient'
import { OnlineTableError } from '../src/game/network/firebase/onlineTable'

const describeWithEmulator = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip
const PROJECT_ID = 'monster-mania-aea35'

describeWithEmulator('Firestore Online Table security rules', () => {
	let environment: RulesTestEnvironment

	beforeAll(async () => {
		environment = await initializeTestEnvironment({
			projectId: PROJECT_ID,
			firestore: { rules: readFileSync('firestore.rules', 'utf8') },
		})
	})

	afterEach(async () => {
		await environment.clearFirestore()
	})

	afterAll(async () => {
		await environment.cleanup()
	})

	function firestoreFor(uid?: string): Firestore {
		return (uid ? environment.authenticatedContext(uid) : environment.unauthenticatedContext()).firestore()
	}

	function clientFor(uid: string, code: string): FirestoreTableClient {
		return new FirestoreTableClient(firestoreFor(uid), { createCode: () => code })
	}

	it('denies unauthenticated access to protected multiplayer data', async () => {
		const host = clientFor('host-a', 'AB7KQ')
		const created = await host.createTable('host-a', 'Host A')
		const unauthenticated = firestoreFor()
		await assertFails(getDoc(doc(unauthenticated, 'tables', created.table.id)))
		await assertFails(getDoc(doc(unauthenticated, 'tableCodes', created.table.joinCode)))
		await assertFails(setDoc(doc(unauthenticated, 'tables', 'forged-table'), { hostUid: 'forged' }))
	})

	it('allows host and guest access while excluding an unrelated third user', async () => {
		const host = clientFor('host-a', 'BC8LR')
		const created = await host.createTable('host-a', 'Host A')
		const joined = await clientFor('guest-b', 'unused').joinTable('guest-b', 'Guest B', created.table.joinCode)
		expect(joined.table.status).toBe('playing')

		await assertSucceeds(getDoc(doc(firestoreFor('host-a'), 'tables', created.table.id)))
		await assertSucceeds(getDoc(doc(firestoreFor('guest-b'), 'tables', created.table.id)))
		await assertFails(getDoc(doc(firestoreFor('third-c'), 'tables', created.table.id)))
		await assertFails(updateDoc(doc(firestoreFor('third-c'), 'tables', created.table.id), { guestName: 'Intruder' }))
	})

	it('keeps each participant private document hidden from the opponent', async () => {
		const created = await clientFor('host-a', 'CD9MS').createTable('host-a', 'Host A')
		await clientFor('guest-b', 'unused').joinTable('guest-b', 'Guest B', created.table.joinCode)
		await environment.withSecurityRulesDisabled(async (context) => {
			await setDoc(doc(context.firestore(), 'tables', created.table.id, 'private', 'host-a'), { hand: ['host-card'] })
			await setDoc(doc(context.firestore(), 'tables', created.table.id, 'private', 'guest-b'), { hand: ['guest-card'] })
		})

		await assertSucceeds(getDoc(doc(firestoreFor('host-a'), 'tables', created.table.id, 'private', 'host-a')))
		await assertSucceeds(getDoc(doc(firestoreFor('guest-b'), 'tables', created.table.id, 'private', 'guest-b')))
		await assertFails(getDoc(doc(firestoreFor('host-a'), 'tables', created.table.id, 'private', 'guest-b')))
		await assertFails(getDoc(doc(firestoreFor('guest-b'), 'tables', created.table.id, 'private', 'host-a')))
	})

	it('reserves authoritative gameplay writes and authority reads for server credentials', async () => {
		const created = await clientFor('host-a', 'CG4NW').createTable('host-a', 'Host A')
		await clientFor('guest-b', 'unused').joinTable('guest-b', 'Guest B', created.table.joinCode)
		const tableRef = doc(firestoreFor('host-a'), 'tables', created.table.id)
		const authorityRef = doc(firestoreFor('host-a'), 'tables', created.table.id, 'authority', 'state')
		await assertFails(updateDoc(tableRef, { revision: 99 }))
		await assertFails(getDoc(authorityRef))
		await assertFails(setDoc(authorityRef, { gameState: { forged: true } }))
	})

	it('atomically grants the final seat to only one simultaneous joiner', async () => {
		const created = await clientFor('host-a', 'DE2NT').createTable('host-a', 'Host A')
		const results = await Promise.allSettled([
			clientFor('guest-b', 'unused').joinTable('guest-b', 'Guest B', created.table.joinCode),
			clientFor('guest-c', 'unused').joinTable('guest-c', 'Guest C', created.table.joinCode),
		])
		expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
		expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
		const rejected = results.find((result) => result.status === 'rejected')
		expect(rejected?.reason).toBeInstanceOf(OnlineTableError)
		expect((rejected?.reason as OnlineTableError).code).toBe('TABLE_FULL')

		await expect(clientFor('third-d', 'unused').joinTable(
			'third-d',
			'Third D',
			created.table.joinCode,
		)).rejects.toMatchObject({ code: 'TABLE_FULL' })
	})

	it('publishes the same membership update to both seated clients', async () => {
		const hostClient = clientFor('host-a', 'EF3PV')
		const guestClient = clientFor('guest-b', 'unused')
		const created = await hostClient.createTable('host-a', 'Host A')
		const hostObservedGuest = new Promise<void>((resolve, reject) => {
			const unsubscribe = hostClient.watchTable(
				created.table.id,
				'host-a',
				(session) => {
					if (session.table.guestUid === 'guest-b') {
						unsubscribe()
						resolve()
					}
				},
				reject,
			)
		})
		const joined = await guestClient.joinTable('guest-b', 'Guest B', created.table.joinCode)
		await expect(hostObservedGuest).resolves.toBeUndefined()
		await expect(guestClient.resumeTable('guest-b', joined.table.id)).resolves.toMatchObject({
			role: 'guest',
			table: { hostUid: 'host-a', guestUid: 'guest-b', status: 'playing' },
		})
	})
})
