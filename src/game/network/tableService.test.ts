import { describe, expect, it } from 'vitest'
import type { GameAction } from '../engine/types'
import type { TableCredentials, TableSession } from './protocol'
import { InMemoryTableService } from './tableService'

function createService(codes = ['ABCDE', 'FGHJK']): InMemoryTableService {
	let codeIndex = 0
	let tokenIndex = 0
	return new InMemoryTableService({
		createCode: () => codes[codeIndex++],
		createToken: () => `secret-${++tokenIndex}`,
		createSeed: () => 12345,
	})
}

function createActiveTable(service: InMemoryTableService): {
	host: TableSession
	guest: TableSession
} {
	const created = service.createTable('Host')
	if (!created.ok) throw new Error(created.error)
	const joined = service.joinTable(created.value.credentials.tableCode, 'Guest')
	if (!joined.ok) throw new Error(joined.error)
	return { host: created.value, guest: joined.value }
}

function credentialsForCurrentPlayer(
	host: TableSession,
	guest: TableSession,
): TableCredentials {
	const currentPlayerId = guest.state?.publicState.turn.currentPlayerId
	return host.credentials.playerId === currentPlayerId
		? host.credentials
		: guest.credentials
}

describe('InMemoryTableService', () => {
	it('creates a waiting two-seat Table and starts when the second player joins', () => {
		const service = createService()
		const created = service.createTable('  Host  ')

		expect(created.ok).toBe(true)
		if (!created.ok) return
		expect(created.value.status).toBe('waiting')
		expect(created.value.state).toBeNull()
		expect(created.value.credentials.tableCode).toBe('ABCDE')

		const joined = service.joinTable('abcde', 'Guest')
		expect(joined.ok).toBe(true)
		if (!joined.ok) return
		expect(joined.value.status).toBe('active')
		expect(joined.value.state?.publicState.players).toHaveLength(2)
		expect(joined.value.state?.publicState.players.map((player) => player.name)).toEqual([
			'Host',
			'Guest',
		])

		const hostState = service.getClientState(created.value.credentials)
		expect(hostState.ok).toBe(true)
	})

	it('rejects malformed, unknown, and full Table codes', () => {
		const service = createService()
		const created = service.createTable('Host')
		if (!created.ok) throw new Error(created.error)

		expect(service.joinTable('bad!', 'Guest')).toMatchObject({
			ok: false,
			code: 'INVALID_TABLE_CODE',
		})
		expect(service.joinTable('ZZZZZ', 'Guest')).toMatchObject({
			ok: false,
			code: 'TABLE_NOT_FOUND',
		})
		expect(service.joinTable(created.value.credentials.tableCode, 'Guest').ok).toBe(true)
		expect(service.joinTable(created.value.credentials.tableCode, 'Third')).toMatchObject({
			ok: false,
			code: 'TABLE_FULL',
		})
	})

	it('requires valid seat credentials and prevents player-id spoofing', () => {
		const service = createService()
		const { host, guest } = createActiveTable(service)
		const actor = credentialsForCurrentPlayer(host, guest)
		const other = actor.playerId === host.credentials.playerId ? guest : host

		expect(
			service.getClientState({ ...actor, seatToken: 'wrong-token' }),
		).toMatchObject({ ok: false, code: 'INVALID_CREDENTIALS' })
		expect(
			service.submitAction(actor, {
				type: 'SKIP_TURN',
				playerId: other.credentials.playerId,
			}),
		).toMatchObject({ ok: false, code: 'PLAYER_MISMATCH' })
	})

	it('rejects out-of-turn and illegal actions before changing authoritative state', () => {
		const service = createService()
		const { host, guest } = createActiveTable(service)
		const actor = credentialsForCurrentPlayer(host, guest)
		const other = actor.playerId === host.credentials.playerId ? guest : host

		expect(
			service.submitAction(other.credentials, {
				type: 'SKIP_TURN',
				playerId: other.credentials.playerId,
			}),
		).toMatchObject({ ok: false, code: 'NOT_YOUR_TURN' })

		const impossibleAction: GameAction = {
			type: 'DEFEAT_MONSTER',
			playerId: actor.playerId,
			monsterId: 'not-a-monster',
		}
		expect(service.submitAction(actor, impossibleAction)).toMatchObject({
			ok: false,
			code: 'ILLEGAL_ACTION',
		})
		const unchanged = service.getClientState(actor)
		expect(unchanged.ok && unchanged.value.publicState.turn.number).toBe(1)
	})

	it('returns synchronized public state after a valid authoritative action', () => {
		const service = createService()
		const { host, guest } = createActiveTable(service)
		const actor = credentialsForCurrentPlayer(host, guest)

		const submitted = service.submitAction(actor, {
			type: 'SKIP_TURN',
			playerId: actor.playerId,
		})
		expect(submitted.ok).toBe(true)

		const hostState = service.getClientState(host.credentials)
		const guestState = service.getClientState(guest.credentials)
		if (!hostState.ok || !guestState.ok) throw new Error('Expected both views.')
		expect(hostState.value.publicState).toEqual(guestState.value.publicState)
		expect(hostState.value.publicState.turn.number).toBe(2)
	})

	it('never serializes the opponent hand into a player view', () => {
		const service = createService()
		const { host, guest } = createActiveTable(service)
		const hostState = service.getClientState(host.credentials)
		const guestState = service.getClientState(guest.credentials)
		if (!hostState.ok || !guestState.ok) throw new Error('Expected both views.')

		const serializedHostView = JSON.stringify(hostState.value)
		for (const privateCard of guestState.value.myHand) {
			expect(serializedHostView).not.toContain(privateCard.instanceId)
		}
		expect(hostState.value.publicState.players[1].handCount).toBe(
			guestState.value.myHand.length,
		)
	})

	it('keeps separate Tables isolated', () => {
		const service = createService()
		const first = createActiveTable(service)
		const second = createActiveTable(service)
		const firstActor = credentialsForCurrentPlayer(first.host, first.guest)

		const submitted = service.submitAction(firstActor, {
			type: 'SKIP_TURN',
			playerId: firstActor.playerId,
		})
		expect(submitted.ok).toBe(true)

		const secondState = service.getClientState(second.guest.credentials)
		expect(secondState.ok && secondState.value.publicState.turn.number).toBe(1)
	})
})
