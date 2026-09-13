import type { PlayerId } from '../definitions/types'
import { applyGameAction } from '../engine/applyGameAction'
import { createGame } from '../engine/createGame'
import type { GameAction, GameState } from '../engine/types'
import { validateGameState } from '../engine/validateGameState'
import { createClientGameState, type ClientGameState } from './clientState'
import {
	createTableCode,
	isValidTableCode,
	normalizeTableCode,
} from './tableCode'
import type {
	SeatToken,
	TableCode,
	TableCredentials,
	TableResult,
	TableSession,
} from './protocol'

interface TableSeat {
	playerId: PlayerId
	playerName: string
	seatToken: SeatToken
}

interface TableRecord {
	code: TableCode
	seats: TableSeat[]
	state: GameState | null
}

export interface TableServiceOptions {
	createCode?: () => TableCode
	createToken?: () => SeatToken
	createSeed?: () => number
}

const MAX_CODE_ATTEMPTS = 100
const MAX_PLAYER_NAME_LENGTH = 32

function defaultToken(): SeatToken {
	const values = globalThis.crypto.getRandomValues(new Uint32Array(4))
	return Array.from(values, (value) => value.toString(36).padStart(7, '0')).join('')
}

function failure<T>(
	code: Exclude<TableResult<T>, { ok: true }>['code'],
	error: string,
): TableResult<T> {
	return { ok: false, code, error }
}

function cleanPlayerName(name: string): string | null {
	const clean = name.trim()
	return clean.length > 0 && clean.length <= MAX_PLAYER_NAME_LENGTH ? clean : null
}

function actionRequiresCurrentTurn(action: GameAction): boolean {
	return action.type !== 'SELECT_DISCARD' && action.type !== 'CONFIRM_DISCARD'
}

export class InMemoryTableService {
	private readonly tables = new Map<TableCode, TableRecord>()
	private readonly createCode: () => TableCode
	private readonly createToken: () => SeatToken
	private readonly createSeed: () => number

	constructor(options: TableServiceOptions = {}) {
		this.createCode = options.createCode ?? createTableCode
		this.createToken = options.createToken ?? defaultToken
		this.createSeed = options.createSeed ?? Date.now
	}

	createTable(playerName: string): TableResult<TableSession> {
		const cleanName = cleanPlayerName(playerName)
		if (!cleanName) {
			return failure('INVALID_PLAYER_NAME', 'Player name must be between 1 and 32 characters.')
		}

		const code = this.allocateCode()
		const seat = this.createSeat(cleanName)
		this.tables.set(code, { code, seats: [seat], state: null })

		return {
			ok: true,
			value: {
				credentials: this.credentials(code, seat),
				status: 'waiting',
				state: null,
			},
		}
	}

	joinTable(tableCode: string, playerName: string): TableResult<TableSession> {
		const cleanName = cleanPlayerName(playerName)
		if (!cleanName) {
			return failure('INVALID_PLAYER_NAME', 'Player name must be between 1 and 32 characters.')
		}
		const lookup = this.lookupTable(tableCode)
		if (!lookup.ok) return lookup
		const table = lookup.value
		if (table.seats.length >= 2) {
			return failure('TABLE_FULL', 'This Table already has two players.')
		}

		const seat = this.createSeat(cleanName)
		table.seats.push(seat)
		table.state = createGame({
			seed: this.createSeed(),
			players: table.seats.map((player) => ({
				id: player.playerId,
				name: player.playerName,
				controller: 'human-remote',
			})),
		})
		const validation = validateGameState(table.state)
		if (!validation.valid) {
			table.seats.pop()
			table.state = null
			return failure('INVALID_GAME_STATE', validation.errors.join(' '))
		}

		return {
			ok: true,
			value: {
				credentials: this.credentials(table.code, seat),
				status: 'playing',
				state: createClientGameState(table.state, seat.playerId),
			},
		}
	}

	getClientState(credentials: TableCredentials): TableResult<ClientGameState> {
		const authorized = this.authorize(credentials)
		if (!authorized.ok) return authorized
		if (!authorized.value.table.state) {
			return failure('GAME_NOT_STARTED', 'The Table is waiting for a second player.')
		}
		return {
			ok: true,
			value: createClientGameState(
				authorized.value.table.state,
				authorized.value.seat.playerId,
			),
		}
	}

	submitAction(
		credentials: TableCredentials,
		action: GameAction,
	): TableResult<ClientGameState> {
		const authorized = this.authorize(credentials)
		if (!authorized.ok) return authorized
		const { table, seat } = authorized.value
		if (!table.state) {
			return failure('GAME_NOT_STARTED', 'The Table is waiting for a second player.')
		}
		if (action.playerId !== seat.playerId) {
			return failure('PLAYER_MISMATCH', 'An action may only identify the authenticated player.')
		}
		if (
			actionRequiresCurrentTurn(action) &&
			table.state.turn.currentPlayerId !== seat.playerId
		) {
			return failure('NOT_YOUR_TURN', 'Only the current player may perform that action.')
		}
		if (
			!actionRequiresCurrentTurn(action) &&
			table.state.pendingDiscard?.playerId !== seat.playerId
		) {
			return failure('NOT_YOUR_TURN', 'Only the player with a pending discard may perform that action.')
		}

		const result = applyGameAction(table.state, action)
		if (!result.ok) {
			return failure('ILLEGAL_ACTION', result.error ?? 'The game rejected that action.')
		}
		const validation = validateGameState(result.state)
		if (!validation.valid) {
			return failure('INVALID_GAME_STATE', validation.errors.join(' '))
		}
		table.state = result.state

		return {
			ok: true,
			value: createClientGameState(table.state, seat.playerId),
		}
	}

	private allocateCode(): TableCode {
		for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
			const code = normalizeTableCode(this.createCode())
			if (!isValidTableCode(code)) {
				throw new Error('The Table code generator returned an invalid code.')
			}
			if (!this.tables.has(code)) return code
		}
		throw new Error('Unable to allocate a unique Table code.')
	}

	private createSeat(playerName: string): TableSeat {
		const seatToken = this.createToken()
		return {
			playerId: `player-${seatToken}`,
			playerName,
			seatToken,
		}
	}

	private credentials(tableCode: TableCode, seat: TableSeat): TableCredentials {
		return {
			tableCode,
			playerId: seat.playerId,
			seatToken: seat.seatToken,
		}
	}

	private lookupTable(tableCode: string): TableResult<TableRecord> {
		if (!isValidTableCode(tableCode)) {
			return failure('INVALID_TABLE_CODE', 'Enter a valid five-character Table code.')
		}
		const table = this.tables.get(normalizeTableCode(tableCode))
		return table
			? { ok: true, value: table }
			: failure('TABLE_NOT_FOUND', 'No active Table uses that code.')
	}

	private authorize(credentials: TableCredentials): TableResult<{
		table: TableRecord
		seat: TableSeat
	}> {
		const lookup = this.lookupTable(credentials.tableCode)
		if (!lookup.ok) return lookup
		const seat = lookup.value.seats.find(
			(candidate) =>
				candidate.playerId === credentials.playerId &&
				candidate.seatToken === credentials.seatToken,
		)
		return seat
			? { ok: true, value: { table: lookup.value, seat } }
			: failure('INVALID_CREDENTIALS', 'Those credentials do not identify a seat at this Table.')
	}
}
