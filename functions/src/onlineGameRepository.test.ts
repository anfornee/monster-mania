import { deleteApp, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import {
	initializeTestEnvironment,
	type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { chooseComputerAction } from '../../src/game/ai/computerStrategy'
import type { GameAction } from '../../src/game/engine/types'
import { OnlineAuthorityError } from '../../src/game/network/authoritativeOnlineGame'
import { FirestoreTableClient } from '../../src/game/network/firebase/firestoreTableClient'
import type {
	AuthoritativeOnlineMatch,
	OnlineGameAction,
	OnlineGameCommand,
	OnlineGameSnapshot,
} from '../../src/game/network/onlineGame'
import {
	initializeMatchForTable,
	leaveTableForParticipant,
	requestRematchForTable,
	submitCommandForTable,
} from './onlineGameRepository'

const describeWithEmulator = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip
const PROJECT_ID = 'monster-mania-aea35'

function commandId(index: number): string {
	return `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`
}

function wireAction(action: GameAction): OnlineGameAction {
	return Object.fromEntries(
		Object.entries(action).filter(([key]) => key !== 'playerId'),
	) as OnlineGameAction
}

describeWithEmulator('Firestore authoritative online game repository', () => {
	let database: Firestore
	let rulesEnvironment: RulesTestEnvironment

	beforeAll(async () => {
		const app = initializeApp({ projectId: PROJECT_ID }, 'online-game-integration')
		database = getFirestore(app)
		rulesEnvironment = await initializeTestEnvironment({ projectId: PROJECT_ID })
	})

	beforeEach(async () => {
		await fetch(
			`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
			{ method: 'DELETE' },
		)
	})

	afterAll(async () => {
		await Promise.all([
			rulesEnvironment.cleanup(),
			...getApps().filter((app) => app.name === 'online-game-integration').map(deleteApp),
		])
	})

	async function seatTable(tableId = 'table-1'): Promise<void> {
		await database.doc(`tables/${tableId}`).set({
			schemaVersion: 1,
			joinCode: 'AB7KQ',
			status: 'playing',
			hostUid: 'host-a',
			hostName: 'Host A',
			guestUid: 'guest-b',
			guestName: 'Guest B',
		})
	}

	async function authority(tableId = 'table-1'): Promise<AuthoritativeOnlineMatch> {
		return (await database.doc(`tables/${tableId}/authority/state`).get()).data() as AuthoritativeOnlineMatch
	}

	function client(uid: string, code = 'AB7KQ'): FirestoreTableClient {
		return new FirestoreTableClient(
			rulesEnvironment.authenticatedContext(uid).firestore(),
			{ createCode: () => code },
		)
	}

	function nextGame(
		tableClient: FirestoreTableClient,
		tableId: string,
		uid: string,
		revision: number,
	): Promise<OnlineGameSnapshot> {
		return new Promise((resolve, reject) => {
			let unsubscribe = () => {}
			unsubscribe = tableClient.watchGame(tableId, uid, (snapshot) => {
				if (snapshot.revision !== revision) return
				unsubscribe()
				resolve(snapshot)
			}, reject)
		})
	}

	it('initializes exactly once and reconnect does not re-deal', async () => {
		await seatTable()
		const first = await initializeMatchForTable(database, 'table-1', () => 12345)
		const initialAuthority = await authority()
		const second = await initializeMatchForTable(database, 'table-1', () => 99999)
		expect(first).toEqual({ initialized: true, revision: 0 })
		expect(second).toEqual({ initialized: false, revision: 0 })
		expect(await authority()).toEqual(initialAuthority)
		expect((await database.doc('tables/table-1/private/host-a').get()).exists).toBe(true)
		expect((await database.doc('tables/table-1/private/guest-b').get()).exists).toBe(true)
	})

	it('serializes concurrent commands and rejects unrelated identities', async () => {
		await seatTable()
		await initializeMatchForTable(database, 'table-1', () => 12345)
		const current = await authority()
		const actor = current.gameState.turn.currentPlayerId
		const first: OnlineGameCommand = {
			tableId: 'table-1',
			commandId: commandId(1),
			expectedRevision: 0,
			action: { type: 'SKIP_TURN' },
		}
		await expect(submitCommandForTable(database, 'third-c', first)).rejects.toBeInstanceOf(OnlineAuthorityError)
		const results = await Promise.allSettled([
			submitCommandForTable(database, actor, first),
			submitCommandForTable(database, actor, { ...first, commandId: commandId(2) }),
		])
		expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
		expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
		expect((await authority()).revision).toBe(1)
	})

	it('starts a fresh match only after both players request a rematch', async () => {
		await seatTable()
		await initializeMatchForTable(database, 'table-1', () => 12345)
		const finished = await authority()
		finished.gameState.phase = 'game-over'
		finished.gameState.winnerId = 'host-a'
		await database.doc('tables/table-1/authority/state').set(finished)
		await database.doc('tables/table-1').update({ status: 'finished' })

		await expect(requestRematchForTable(database, 'table-1', 'host-a', () => 24680))
			.resolves.toEqual({ rematchStarted: false, revision: 0 })
		expect((await database.doc('tables/table-1').get()).data()?.rematchRequests)
			.toEqual({ host: true, guest: false })

		await expect(requestRematchForTable(database, 'table-1', 'guest-b', () => 24680))
			.resolves.toEqual({ rematchStarted: true, revision: 1 })
		const restarted = await authority()
		expect(restarted.gameState.phase).not.toBe('game-over')
		expect(restarted.gameState.winnerId).toBeNull()
		expect((await database.doc('tables/table-1').get()).data()).toMatchObject({
			status: 'playing',
			rematchRequests: { host: false, guest: false },
			revision: 1,
		})
	})

	it('removes the Table and every known gameplay document when either player leaves', async () => {
		const hostClient = client('host-a', 'GH6RT')
		const created = await hostClient.createTable('host-a', 'Host A', 'public')
		await client('guest-b').joinTable('guest-b', 'Guest B', created.table.joinCode)
		await initializeMatchForTable(database, created.table.id, () => 12345)

		await expect(leaveTableForParticipant(database, created.table.id, 'guest-b'))
			.resolves.toEqual({ removed: true })
		for (const path of [
			`tables/${created.table.id}`,
			`tableCodes/${created.table.joinCode}`,
			`tables/${created.table.id}/authority/state`,
			`tables/${created.table.id}/private/host-a`,
			`tables/${created.table.id}/private/guest-b`,
		]) {
			expect((await database.doc(path).get()).exists).toBe(false)
		}
	})

	it('synchronizes alternating actions to both player-filtered browser views', async () => {
		const hostClient = client('host-a', 'HJ7KQ')
		const guestClient = client('guest-b')
		const created = await hostClient.createTable('host-a', 'Host A')
		await guestClient.joinTable('guest-b', 'Guest B', created.table.joinCode)
		await initializeMatchForTable(database, created.table.id, () => 12345)

		const initialAuthority = await authority(created.table.id)
		const [hostInitial, guestInitial] = await Promise.all([
			nextGame(hostClient, created.table.id, 'host-a', 0),
			nextGame(guestClient, created.table.id, 'guest-b', 0),
		])
		expect(hostInitial.state.players.find((player) => player.id === 'host-a')?.hand)
			.toEqual(initialAuthority.gameState.players.find((player) => player.id === 'host-a')?.hand)
		expect(guestInitial.state.players.find((player) => player.id === 'guest-b')?.hand)
			.toEqual(initialAuthority.gameState.players.find((player) => player.id === 'guest-b')?.hand)
		for (const card of initialAuthority.gameState.players.find((player) => player.id === 'guest-b')!.hand) {
			expect(JSON.stringify(hostInitial)).not.toContain(card.instanceId)
		}

		const firstActor = initialAuthority.gameState.turn.currentPlayerId
		const firstObserver = firstActor === 'host-a' ? guestClient : hostClient
		const firstObserverUid = firstActor === 'host-a' ? 'guest-b' : 'host-a'
		const firstUpdate = nextGame(firstObserver, created.table.id, firstObserverUid, 1)
		await submitCommandForTable(database, firstActor, {
			tableId: created.table.id,
			commandId: commandId(10),
			expectedRevision: 0,
			action: { type: 'SKIP_TURN' },
		})
		await expect(firstUpdate).resolves.toMatchObject({ revision: 1 })

		const afterFirst = await authority(created.table.id)
		const secondActor = afterFirst.gameState.turn.currentPlayerId
		expect(secondActor).not.toBe(firstActor)
		const secondObserver = secondActor === 'host-a' ? guestClient : hostClient
		const secondObserverUid = secondActor === 'host-a' ? 'guest-b' : 'host-a'
		const secondUpdate = nextGame(secondObserver, created.table.id, secondObserverUid, 2)
		await submitCommandForTable(database, secondActor, {
			tableId: created.table.id,
			commandId: commandId(11),
			expectedRevision: 1,
			action: { type: 'SKIP_TURN' },
		})
		await expect(secondUpdate).resolves.toMatchObject({ revision: 2 })
	}, 30_000)

	it('plays a complete deterministic two-player match through normal engine actions', async () => {
		await seatTable()
		await initializeMatchForTable(database, 'table-1', () => 24680)
		for (let index = 1; index <= 500; index += 1) {
			const current = await authority()
			if (current.gameState.phase === 'game-over') break
			const actor = current.gameState.pendingDiscard?.playerId ?? current.gameState.turn.currentPlayerId
			const decisionState = structuredClone(current.gameState)
			decisionState.players.find((player) => player.id === actor)!.controller = 'computer'
			const action = chooseComputerAction(decisionState, actor)
			if (!action) throw new Error(`No legal action was selected at revision ${current.revision}.`)
			await submitCommandForTable(database, actor, {
				tableId: 'table-1',
				commandId: commandId(index),
				expectedRevision: current.revision,
				action: wireAction(action),
			})
		}
		const finished = await authority()
		expect(finished.gameState.phase).toBe('game-over')
		expect(finished.gameState.winnerId).toMatch(/^(host-a|guest-b)$/)
		expect((await database.doc('tables/table-1').get()).data()?.status).toBe('finished')
		const actor = finished.gameState.winnerId!
		await expect(submitCommandForTable(database, actor, {
			tableId: 'table-1',
			commandId: commandId(501),
			expectedRevision: finished.revision,
			action: { type: 'SKIP_TURN' },
		})).rejects.toThrowError(expect.objectContaining({ code: 'GAME_FINISHED' }))
	}, 60_000)
})
