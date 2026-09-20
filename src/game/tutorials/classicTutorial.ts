import { CORE_CATALOG } from '../definitions/core'
import type { PlayerCardInstance } from '../definitions/types'
import { buildPlayerCardInstances, createGame } from '../engine/createGame'
import type { GameAction, GameState } from '../engine/types'
import type { TutorialLessonDefinition } from './types'

export const CLASSIC_TUTORIAL_PLAYER_ID = 'trainee'

export const CLASSIC_TUTORIAL_LESSONS: readonly TutorialLessonDefinition[] = [
	{
		id: 'read-the-table',
		title: 'Read the hunt',
		instruction: 'Your hand is at the bottom, the Monsters are in the center, and your training partner sits across the table. Scores come from defeated Monsters.',
		hint: 'You can inspect any card or Monster without changing the game.',
		requiredAction: null,
	},
	{
		id: 'play-draw-two',
		title: 'Play an Action',
		instruction: 'Actions happen before a Monster defeat. Your hand is already at its five-card limit, so play Draw 2 to see how extra cards are handled.',
		hint: 'Choose Draw 2 in your hand, then select Play card.',
		requiredAction: { type: 'PLAY_ACTION_CARD', cardDefinitionId: 'draw-2' },
	},
	{
		id: 'select-discard',
		title: 'Choose a discard',
		instruction: 'Draw 2 resolved in full, leaving six cards in your hand. You must discard one before continuing the Action Phase. Select Mace so the Weapons needed for this lesson stay together.',
		hint: 'Select the Mace card. Selected cards receive a clear highlight.',
		requiredAction: { type: 'SELECT_DISCARD', cardDefinitionId: 'mace' },
	},
	{
		id: 'confirm-discard',
		title: 'Confirm your choice',
		instruction: 'A discard is not final until you confirm it. You can normally change your selection before confirming.',
		hint: 'Select Confirm discard beside your hand.',
		requiredAction: { type: 'CONFIRM_DISCARD' },
	},
	{
		id: 'chain-draw-one',
		title: 'Chain a new Action',
		instruction: 'Draw 2 revealed another Action. Newly drawn Actions can be played immediately while the Action Phase remains open.',
		hint: 'Play the Draw 1 you just received.',
		requiredAction: { type: 'PLAY_ACTION_CARD', cardDefinitionId: 'draw-1' },
	},
	{
		id: 'match-weapons',
		title: 'Match the requirement',
		instruction: 'Pincher requires Grenade, Spear, and Sword. You hold all three, while the more valuable Thing is still missing Gun / Rifle. Compare point values, then choose the highest-value Monster you can actually defeat.',
		hint: 'Requirement markers show which Weapons are ready. Pincher is the only beatable Monster this turn.',
		requiredAction: null,
	},
	{
		id: 'defeat-pincher',
		title: 'Defeat your first Monster',
		instruction: 'Use your matching Weapons to defeat Pincher. A Monster defeat ends the turn, so Actions must always come first.',
		hint: 'Choose Pincher, then select Defeat Monster.',
		requiredAction: { type: 'DEFEAT_MONSTER', monsterId: 'pincher' },
		followUpActions: [{ type: 'SKIP_TURN', playerId: 'trainer' }],
	},
	{
		id: 'end-turn-choice',
		title: 'When you cannot—or choose not to—fight',
		instruction: 'You do not have to defeat a Monster. If none is beatable, or you want to save your cards, end your turn instead.',
		hint: 'Ending a turn draws one card, then immediately passes play. You cannot use the newly drawn card until a later turn.',
		requiredAction: null,
	},
	{
		id: 'end-turn',
		title: 'End the turn',
		instruction: 'Use End turn now. Because your hand is below its limit, you will draw one card and the Guild Trainer will take the next turn.',
		hint: 'Select End turn beside your hand.',
		requiredAction: { type: 'SKIP_TURN' },
		followUpActions: [{ type: 'SKIP_TURN', playerId: 'trainer' }],
	},
	{
		id: 'meet-the-ultimate',
		title: 'You drew the Ultimate Weapon',
		instruction: 'Ending your turn gave you Black Hole. It defeats one regular face-up Monster without spending that Monster’s required Weapons, then ends your turn.',
		hint: 'Only one Black Hole exists, so deciding when to spend it matters. It cannot defeat The Infinity Beast.',
		requiredAction: null,
	},
	{
		id: 'use-black-hole',
		title: 'Finish with Black Hole',
		instruction: 'Thing normally requires four matching Weapons. Use your newly drawn Black Hole to defeat it without paying that requirement.',
		hint: 'Choose Thing, then select Use Ultimate Weapon.',
		requiredAction: {
			type: 'USE_ULTIMATE_WEAPON',
			cardDefinitionId: 'black-hole',
			monsterId: 'thing',
		},
	},
]

function takeCards(
	pool: Map<string, PlayerCardInstance[]>,
	definitionIds: readonly string[],
): PlayerCardInstance[] {
	return definitionIds.map((definitionId) => {
		const card = pool.get(definitionId)?.shift()
		if (!card) throw new Error(`Classic tutorial requested unavailable card: ${definitionId}.`)
		return card
	})
}

export function createClassicTutorialState(playerName: string): GameState {
	const state = createGame({
		seed: 20240921,
		startingPlayerId: CLASSIC_TUTORIAL_PLAYER_ID,
		players: [
			{ id: CLASSIC_TUTORIAL_PLAYER_ID, name: playerName, controller: 'human-local' },
			{ id: 'trainer', name: 'Guild Trainer', controller: 'computer' },
		],
	})
	const pool = new Map<string, PlayerCardInstance[]>()
	for (const card of buildPlayerCardInstances(CORE_CATALOG)) {
		const matches = pool.get(card.definitionId) ?? []
		matches.push(card)
		pool.set(card.definitionId, matches)
	}

	state.players[0].hand = takeCards(pool, ['draw-2', 'bow', 'grenade', 'mace', 'mace'])
	state.players[1].hand = takeCards(pool, ['mace', 'spear', 'gun'])
	const tutorialDraws = takeCards(pool, ['draw-1', 'sword', 'spear', 'bow', 'black-hole'])
	state.drawPile = [...tutorialDraws, ...Array.from(pool.values()).flat()]
	state.discardPile = []
	state.removedPlayerCards = []
	state.faceUpMonsterIds = ['pincher', 'thing']
	state.monsterDeck = Object.keys(CORE_CATALOG.regularMonsters).filter(
		(monsterId) => !state.faceUpMonsterIds.includes(monsterId),
	)
	state.events = [{
		id: 1,
		type: 'game-started',
		message: `${playerName}'s Classic training began.`,
	}]
	state.nextEventId = 2
	return state
}

export function matchesTutorialAction(
	state: GameState,
	action: GameAction,
	lesson: TutorialLessonDefinition,
): boolean {
	const requirement = lesson.requiredAction
	if (!requirement || action.playerId !== CLASSIC_TUTORIAL_PLAYER_ID || action.type !== requirement.type) {
		return false
	}
	if ('cardInstanceId' in action && requirement.cardDefinitionId) {
		const player = state.players.find((candidate) => candidate.id === action.playerId)
		const card = player?.hand.find((candidate) => candidate.instanceId === action.cardInstanceId)
		if (card?.definitionId !== requirement.cardDefinitionId) return false
	}
	if ('monsterId' in action && requirement.monsterId !== undefined) {
		return action.monsterId === requirement.monsterId
	}
	return true
}
