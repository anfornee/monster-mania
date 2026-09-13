import { describe, expect, it } from 'vitest'
import {
	applyOnlineGameCommand,
	initializeOnlineMatch,
	OnlineAuthorityError,
	parseOnlineGameCommand,
	type SeatedOnlineTable,
} from './authoritativeOnlineGame'
import type { AuthoritativeOnlineMatch, OnlineGameCommand } from './onlineGame'

const table: SeatedOnlineTable = {
	id: 'table-1',
	status: 'playing',
	hostUid: 'host-a',
	hostName: 'Host A',
	guestUid: 'guest-b',
	guestName: 'Guest B',
}

const ids = [
	'00000000-0000-4000-8000-000000000001',
	'00000000-0000-4000-8000-000000000002',
	'00000000-0000-4000-8000-000000000003',
]

function command(
	commandId: string,
	expectedRevision: number,
	action: OnlineGameCommand['action'] = { type: 'SKIP_TURN' },
): OnlineGameCommand {
	return { tableId: table.id, commandId, expectedRevision, action }
}

function initialized(): ReturnType<typeof initializeOnlineMatch> {
	return initializeOnlineMatch(table, 12345)
}

function currentUid(authority: AuthoritativeOnlineMatch): string {
	return authority.gameState.pendingDiscard?.playerId ?? authority.gameState.turn.currentPlayerId
}

describe('authoritative online game', () => {
	it('initializes one deterministic remote-human match with separated private hands', () => {
		const first = initialized()
		const second = initialized()
		expect(first.authority).toEqual(second.authority)
		expect(first.authority.revision).toBe(0)
		expect(first.authority.gameState.players.map((player) => player.controller)).toEqual([
			'human-remote',
			'human-remote',
		])
		expect(first.privateByUid['host-a'].hand).toHaveLength(3)
		expect(first.privateByUid['guest-b'].hand).toHaveLength(3)
		const publicJson = JSON.stringify(first.public)
		for (const card of [...first.privateByUid['host-a'].hand, ...first.privateByUid['guest-b'].hand]) {
			expect(publicJson).not.toContain(card.instanceId)
		}
	})

	it('accepts valid actions from each seat and increments once per command', () => {
		const first = initialized()
		const firstActor = currentUid(first.authority)
		const afterFirst = applyOnlineGameCommand(
			table,
			first.authority,
			firstActor,
			command(ids[0], 0),
		)
		expect(afterFirst.authority.revision).toBe(1)
		const secondActor = currentUid(afterFirst.authority)
		expect(secondActor).not.toBe(firstActor)
		const afterSecond = applyOnlineGameCommand(
			table,
			afterFirst.authority,
			secondActor,
			command(ids[1], 1),
		)
		expect(afterSecond.authority.revision).toBe(2)
	})

	it('rejects wrong-turn, unrelated, illegal, stale, and post-finish commands', () => {
		const match = initialized()
		const actor = currentUid(match.authority)
		const other = actor === table.hostUid ? table.guestUid! : table.hostUid
		expect(() => applyOnlineGameCommand(table, match.authority, other, command(ids[0], 0)))
			.toThrowError(expect.objectContaining({ code: 'NOT_YOUR_TURN' }))
		expect(() => applyOnlineGameCommand(table, match.authority, 'third-c', command(ids[0], 0)))
			.toThrowError(expect.objectContaining({ code: 'NOT_A_PARTICIPANT' }))
		expect(() => applyOnlineGameCommand(
			table,
			match.authority,
			actor,
			command(ids[0], 0, { type: 'DEFEAT_MONSTER', monsterId: 'not-a-monster' }),
		)).toThrowError(expect.objectContaining({ code: 'ILLEGAL_ACTION' }))
		expect(() => applyOnlineGameCommand(table, match.authority, actor, command(ids[0], 99)))
			.toThrowError(expect.objectContaining({ code: 'STALE_REVISION' }))

		const finished = structuredClone(match.authority)
		finished.gameState.phase = 'game-over'
		finished.gameState.winnerId = actor
		expect(() => applyOnlineGameCommand(table, finished, actor, command(ids[0], 0)))
			.toThrowError(expect.objectContaining({ code: 'GAME_FINISHED' }))
	})

	it('returns duplicate command success without applying the action twice', () => {
		const match = initialized()
		const actor = currentUid(match.authority)
		const other = actor === table.hostUid ? table.guestUid! : table.hostUid
		const first = applyOnlineGameCommand(table, match.authority, actor, command(ids[0], 0))
		const retried = applyOnlineGameCommand(table, first.authority, actor, command(ids[0], 0))
		expect(retried.duplicate).toBe(true)
		expect(retried.authority).toEqual(first.authority)
		expect(retried.authority.revision).toBe(1)
		expect(() => applyOnlineGameCommand(table, first.authority, other, command(ids[0], 0)))
			.toThrowError(expect.objectContaining({ code: 'INVALID_ARGUMENT' }))
	})

	it('makes a concurrent loser stale against the committed revision', () => {
		const match = initialized()
		const actor = currentUid(match.authority)
		const winner = applyOnlineGameCommand(table, match.authority, actor, command(ids[0], 0))
		expect(() => applyOnlineGameCommand(table, winner.authority, actor, command(ids[1], 0)))
			.toThrowError(expect.objectContaining({ code: 'STALE_REVISION' }))
	})

	it('strictly parses untrusted commands without accepting a client player ID', () => {
		expect(parseOnlineGameCommand(command(ids[0], 0))).toEqual(command(ids[0], 0))
		expect(() => parseOnlineGameCommand({
			...command(ids[0], 0),
			action: { type: 'SKIP_TURN', playerId: 'forged' },
		})).toThrow(OnlineAuthorityError)
		expect(() => parseOnlineGameCommand({ ...command(ids[0], 0), commandId: 'guessable' }))
			.toThrowError(expect.objectContaining({ code: 'INVALID_ARGUMENT' }))
	})
})
