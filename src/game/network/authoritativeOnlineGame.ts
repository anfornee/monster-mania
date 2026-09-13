import { CORE_CATALOG } from '../definitions/core'
import type { PlayerCardDefinitionId, PlayerId } from '../definitions/types'
import { applyGameAction } from '../engine/applyGameAction'
import { createGame } from '../engine/createGame'
import type { GameAction, GameState } from '../engine/types'
import { validateGameState } from '../engine/validateGameState'
import { getPlayer, getRequiredWeaponInstances } from '../selectors/gameSelectors'
import { createClientGameState } from './clientState'
import {
	MAX_PROCESSED_ONLINE_COMMANDS,
	type AuthoritativeOnlineMatch,
	type OnlineGameAction,
	type OnlineGameCommand,
	type OnlineGameEvent,
	type OnlinePrivateGameState,
	type OnlinePublicGameFields,
} from './onlineGame'

export type OnlineAuthorityErrorCode =
	| 'UNAUTHENTICATED'
	| 'INVALID_ARGUMENT'
	| 'TABLE_NOT_FOUND'
	| 'NOT_A_PARTICIPANT'
	| 'GAME_NOT_STARTED'
	| 'GAME_FINISHED'
	| 'NOT_YOUR_TURN'
	| 'STALE_REVISION'
	| 'ILLEGAL_ACTION'
	| 'INVALID_GAME_STATE'

export class OnlineAuthorityError extends Error {
	readonly code: OnlineAuthorityErrorCode

	constructor(code: OnlineAuthorityErrorCode, message: string) {
		super(message)
		this.name = 'OnlineAuthorityError'
		this.code = code
	}
}

export interface SeatedOnlineTable {
	id: string
	status: 'waiting' | 'playing' | 'finished'
	hostUid: string
	hostName: string
	guestUid: string | null
	guestName: string | null
}

export interface OnlineMatchWriteModel {
	authority: AuthoritativeOnlineMatch
	public: OnlinePublicGameFields
	privateByUid: Record<string, OnlinePrivateGameState>
	duplicate: boolean
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function record(value: unknown): Record<string, unknown> | null {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
		? value as Record<string, unknown>
		: null
}

function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
	const actual = Object.keys(value).sort()
	return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index])
}

function boundedString(value: unknown, maximum = 160): value is string {
	return typeof value === 'string' && value.length > 0 && value.length <= maximum
}

function parseAction(value: unknown): OnlineGameAction {
	const action = record(value)
	if (!action || typeof action.type !== 'string') {
		throw new OnlineAuthorityError('INVALID_ARGUMENT', 'The gameplay action is invalid.')
	}
	switch (action.type) {
		case 'PLAY_ACTION_CARD':
			if (!exactKeys(action, ['type', 'cardInstanceId']) || !boundedString(action.cardInstanceId)) break
			return { type: action.type, cardInstanceId: action.cardInstanceId }
		case 'DEFEAT_MONSTER':
			if (!exactKeys(action, ['type', 'monsterId']) || !boundedString(action.monsterId)) break
			return { type: action.type, monsterId: action.monsterId }
		case 'USE_ULTIMATE_WEAPON':
			if (
				!exactKeys(action, ['type', 'cardInstanceId', 'monsterId'])
				|| !boundedString(action.cardInstanceId)
				|| !boundedString(action.monsterId)
			) break
			return {
				type: action.type,
				cardInstanceId: action.cardInstanceId,
				monsterId: action.monsterId,
			}
		case 'SELECT_DISCARD':
			if (!exactKeys(action, ['type', 'cardInstanceId']) || !boundedString(action.cardInstanceId)) break
			return { type: action.type, cardInstanceId: action.cardInstanceId }
		case 'CONFIRM_DISCARD':
		case 'SKIP_TURN':
			if (!exactKeys(action, ['type'])) break
			return { type: action.type }
	}
	throw new OnlineAuthorityError('INVALID_ARGUMENT', 'The gameplay action is invalid.')
}

export function parseOnlineGameCommand(value: unknown): OnlineGameCommand {
	const command = record(value)
	if (
		!command
		|| !exactKeys(command, ['tableId', 'commandId', 'expectedRevision', 'action'])
		|| !boundedString(command.tableId, 128)
		|| typeof command.commandId !== 'string'
		|| !UUID_PATTERN.test(command.commandId)
		|| !Number.isSafeInteger(command.expectedRevision)
		|| (command.expectedRevision as number) < 0
	) {
		throw new OnlineAuthorityError('INVALID_ARGUMENT', 'The online game command is invalid.')
	}
	return {
		tableId: command.tableId,
		commandId: command.commandId,
		expectedRevision: command.expectedRevision as number,
		action: parseAction(command.action),
	}
}

function requireParticipant(table: SeatedOnlineTable, uid: string): PlayerId {
	if (table.hostUid === uid) return table.hostUid
	if (table.guestUid === uid) return table.guestUid
	throw new OnlineAuthorityError('NOT_A_PARTICIPANT', 'This identity does not hold a seat at the Table.')
}

function gameActionFor(action: OnlineGameAction, playerId: PlayerId): GameAction {
	return { ...action, playerId } as GameAction
}

function revealedCards(state: GameState, action: GameAction): {
	kind: OnlineGameEvent['kind']
	cardDefinitionIds: PlayerCardDefinitionId[]
} {
	const player = getPlayer(state, action.playerId)
	if (!player) return { kind: null, cardDefinitionIds: [] }
	switch (action.type) {
		case 'PLAY_ACTION_CARD':
		case 'USE_ULTIMATE_WEAPON': {
			const card = player.hand.find((candidate) => candidate.instanceId === action.cardInstanceId)
			return { kind: 'played', cardDefinitionIds: card ? [card.definitionId] : [] }
		}
		case 'DEFEAT_MONSTER': {
			const monster = state.mode === 'sudden-death'
				? CORE_CATALOG.suddenDeathMonster
				: CORE_CATALOG.regularMonsters[action.monsterId]
			const cards = monster
				? getRequiredWeaponInstances(player.hand, monster.requiredWeapons, CORE_CATALOG)
				: null
			return { kind: 'played', cardDefinitionIds: cards?.map((card) => card.definitionId) ?? [] }
		}
		case 'CONFIRM_DISCARD': {
			const selected = new Set(state.pendingDiscard?.selectedCardInstanceIds ?? [])
			return {
				kind: 'discarded',
				cardDefinitionIds: player.hand
					.filter((card) => selected.has(card.instanceId))
					.map((card) => card.definitionId),
			}
		}
		case 'SELECT_DISCARD':
		case 'SKIP_TURN':
			return { kind: null, cardDefinitionIds: [] }
	}
}

function writeModel(
	authority: AuthoritativeOnlineMatch,
	event: OnlineGameEvent | null,
	duplicate = false,
): OnlineMatchWriteModel {
	const privateByUid = Object.fromEntries(authority.gameState.players.map((player) => [
		player.id,
		{
			schemaVersion: 1 as const,
			revision: authority.revision,
			playerId: player.id,
			hand: structuredClone(player.hand),
			selectedCardInstanceIds: authority.gameState.pendingDiscard?.playerId === player.id
				? [...authority.gameState.pendingDiscard.selectedCardInstanceIds]
				: [],
		},
	]))
	return {
		authority,
		public: {
			revision: authority.revision,
			publicGameState: createClientGameState(authority.gameState, authority.gameState.players[0].id).publicState,
			lastGameEvent: event,
		},
		privateByUid,
		duplicate,
	}
}

export function initializeOnlineMatch(
	table: SeatedOnlineTable,
	seed: number,
): OnlineMatchWriteModel {
	if (table.status !== 'playing' || !table.guestUid || !table.guestName) {
		throw new OnlineAuthorityError('GAME_NOT_STARTED', 'Both Table seats must be filled before gameplay starts.')
	}
	const gameState = createGame({
		seed,
		players: [
			{ id: table.hostUid, name: table.hostName, controller: 'human-remote' },
			{ id: table.guestUid, name: table.guestName, controller: 'human-remote' },
		],
	})
	return writeModel({ schemaVersion: 1, revision: 0, gameState, processedCommands: [] }, null)
}

export function applyOnlineGameCommand(
	table: SeatedOnlineTable,
	authority: AuthoritativeOnlineMatch | null,
	uid: string,
	command: OnlineGameCommand,
): OnlineMatchWriteModel {
	const playerId = requireParticipant(table, uid)
	if (!authority) throw new OnlineAuthorityError('GAME_NOT_STARTED', 'The authoritative match is still initializing.')
	const duplicate = authority.processedCommands.find((entry) => entry.commandId === command.commandId)
	if (duplicate) {
		if (duplicate.actorUid !== uid) {
			throw new OnlineAuthorityError('INVALID_ARGUMENT', 'That command ID belongs to another participant.')
		}
		return writeModel(authority, null, true)
	}
	if (authority.gameState.phase === 'game-over' || table.status === 'finished') {
		throw new OnlineAuthorityError('GAME_FINISHED', 'This match has already finished.')
	}
	if (command.expectedRevision !== authority.revision) {
		throw new OnlineAuthorityError('STALE_REVISION', 'The match changed before this command arrived.')
	}
	const decisionPlayerId = authority.gameState.pendingDiscard?.playerId
		?? authority.gameState.turn.currentPlayerId
	if (decisionPlayerId !== playerId) {
		throw new OnlineAuthorityError('NOT_YOUR_TURN', 'It is not your turn to act.')
	}
	const action = gameActionFor(command.action, playerId)
	const revealed = revealedCards(authority.gameState, action)
	const result = applyGameAction(authority.gameState, action, CORE_CATALOG)
	if (!result.ok) throw new OnlineAuthorityError('ILLEGAL_ACTION', result.error ?? 'That action is not legal.')
	const validation = validateGameState(result.state, CORE_CATALOG)
	if (!validation.valid) {
		throw new OnlineAuthorityError('INVALID_GAME_STATE', validation.errors.join(' '))
	}
	const revision = authority.revision + 1
	const nextAuthority: AuthoritativeOnlineMatch = {
		schemaVersion: 1,
		revision,
		gameState: result.state,
		processedCommands: [
			...authority.processedCommands,
			{ commandId: command.commandId, revision, actorUid: uid },
		].slice(-MAX_PROCESSED_ONLINE_COMMANDS),
	}
	const event: OnlineGameEvent = {
		id: command.commandId,
		revision,
		actorPlayerId: playerId,
		actionType: action.type,
		kind: revealed.kind,
		revealedCardDefinitionIds: revealed.cardDefinitionIds,
		monsterId: 'monsterId' in action ? action.monsterId : null,
	}
	return writeModel(nextAuthority, event)
}
