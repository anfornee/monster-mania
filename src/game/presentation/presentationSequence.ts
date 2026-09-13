import { CORE_CATALOG } from '../definitions/core'
import type {
	GameCatalog,
	PlayerCardDefinitionId,
	PlayerId,
} from '../definitions/types'
import type { GameAction, GameState } from '../engine/types'
import { getPlayer, getRequiredWeaponInstances } from '../selectors/gameSelectors'
import { getGameAnnouncement, type GameAnnouncementDetails } from './announcements'

export interface OpponentCardPresentation {
	id: string
	kind: 'played' | 'discarded'
	playerName: string
	cardDefinitionIds: PlayerCardDefinitionId[]
}

export type GamePresentationStep =
	| { type: 'opponent-card'; card: OpponentCardPresentation }
	| { type: 'announcement'; announcement: GameAnnouncementDetails }

function getOpponentCardPresentation(
	state: GameState,
	action: GameAction,
	localPlayerId: PlayerId,
	catalog: GameCatalog,
): OpponentCardPresentation | null {
	if (action.playerId === localPlayerId) return null
	const player = getPlayer(state, action.playerId)
	if (!player) return null

	let kind: OpponentCardPresentation['kind'] = 'played'
	let cardDefinitionIds: PlayerCardDefinitionId[] = []

	switch (action.type) {
		case 'PLAY_ACTION_CARD':
		case 'USE_ULTIMATE_WEAPON': {
			const card = player.hand.find((candidate) => candidate.instanceId === action.cardInstanceId)
			if (card) cardDefinitionIds = [card.definitionId]
			break
		}
		case 'DEFEAT_MONSTER': {
			const monster = state.mode === 'sudden-death'
				? catalog.suddenDeathMonster
				: catalog.regularMonsters[action.monsterId]
			if (monster) {
				cardDefinitionIds = getRequiredWeaponInstances(
					player.hand,
					monster.requiredWeapons,
					catalog,
				)?.map((card) => card.definitionId) ?? []
			}
			break
		}
		case 'CONFIRM_DISCARD': {
			kind = 'discarded'
			const selected = new Set(state.pendingDiscard?.selectedCardInstanceIds ?? [])
			cardDefinitionIds = player.hand
				.filter((card) => selected.has(card.instanceId))
				.map((card) => card.definitionId)
			break
		}
		case 'SELECT_DISCARD':
		case 'SKIP_TURN':
			break
	}

	if (cardDefinitionIds.length === 0) return null
	return {
		id: `${state.turn.number}-${action.type}-${cardDefinitionIds.join('-')}`,
		kind,
		playerName: player.name,
		cardDefinitionIds,
	}
}

export function getActionPresentationSteps(
	before: GameState,
	after: GameState,
	action: GameAction,
	localPlayerId: PlayerId,
	catalog: GameCatalog = CORE_CATALOG,
): GamePresentationStep[] {
	const steps: GamePresentationStep[] = []
	const card = getOpponentCardPresentation(before, action, localPlayerId, catalog)
	if (card) steps.push({ type: 'opponent-card', card })

	const previousEventId = before.events.at(-1)?.id ?? 0
	const announcement = getGameAnnouncement(after.events, previousEventId)
	if (announcement) steps.push({ type: 'announcement', announcement })
	return steps
}
