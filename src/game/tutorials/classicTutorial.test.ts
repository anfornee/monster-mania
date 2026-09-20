import { describe, expect, it } from 'vitest'
import { CORE_CATALOG } from '../definitions/core'
import { applyGameAction } from '../engine/applyGameAction'
import type { GameAction } from '../engine/types'
import { validateGameState } from '../engine/validateGameState'
import { canDefeatMonster, getPlayerScore } from '../selectors/gameSelectors'
import {
	CLASSIC_TUTORIAL_LESSONS,
	CLASSIC_TUTORIAL_PLAYER_ID,
	createClassicTutorialState,
	matchesTutorialAction,
} from './classicTutorial'

function actionCard(state: ReturnType<typeof createClassicTutorialState>, definitionId: string): GameAction {
	const card = state.players[0].hand.find((candidate) => candidate.definitionId === definitionId)!
	return { type: 'PLAY_ACTION_CARD', playerId: CLASSIC_TUTORIAL_PLAYER_ID, cardInstanceId: card.instanceId }
}

function applyLessonAction(
	state: ReturnType<typeof createClassicTutorialState>,
	lessonId: string,
	action: GameAction,
) {
	const lesson = CLASSIC_TUTORIAL_LESSONS.find((candidate) => candidate.id === lessonId)!
	expect(matchesTutorialAction(state, action, lesson)).toBe(true)
	const result = applyGameAction(state, action, CORE_CATALOG)
	expect(result.ok).toBe(true)
	let nextState = result.state
	for (const followUpAction of lesson.followUpActions ?? []) {
		const followUp = applyGameAction(nextState, followUpAction, CORE_CATALOG)
		expect(followUp.ok).toBe(true)
		nextState = followUp.state
	}
	return nextState
}

describe('Classic tutorial', () => {
	it('creates a deterministic valid scenario', () => {
		const first = createClassicTutorialState('Rowan')
		const second = createClassicTutorialState('Rowan')

		expect(first).toEqual(second)
		expect(validateGameState(first)).toMatchObject({ valid: true, errors: [] })
		expect(first.faceUpMonsterIds).toEqual(['pincher', 'thing'])
	})

	it('completes discard, Action chaining, Weapon, Ultimate, and end-turn lessons through the real engine', () => {
		let state = createClassicTutorialState('Rowan')
		const drawTwo = actionCard(state, 'draw-2')
		state = applyLessonAction(state, 'play-draw-two', drawTwo)
		expect(state.phase).toBe('forced-discard')
		expect(state.pendingDiscard?.requiredCount).toBe(1)

		const mace = state.players[0].hand.find((card) => card.definitionId === 'mace')!
		state = applyLessonAction(state, 'select-discard', {
			type: 'SELECT_DISCARD',
			playerId: CLASSIC_TUTORIAL_PLAYER_ID,
			cardInstanceId: mace.instanceId,
		})
		expect(state.pendingDiscard?.selectedCardInstanceIds).toEqual([mace.instanceId])
		state = applyLessonAction(state, 'confirm-discard', {
			type: 'CONFIRM_DISCARD',
			playerId: CLASSIC_TUTORIAL_PLAYER_ID,
		})
		expect(state.phase).toBe('action')
		expect(state.players[0].hand).toHaveLength(5)

		const drawOne = actionCard(state, 'draw-1')
		state = applyLessonAction(state, 'chain-draw-one', drawOne)
		expect(canDefeatMonster(state, CLASSIC_TUTORIAL_PLAYER_ID, 'pincher', CORE_CATALOG)).toBe(true)
		expect(canDefeatMonster(state, CLASSIC_TUTORIAL_PLAYER_ID, 'thing', CORE_CATALOG)).toBe(false)

		const defeat: GameAction = {
			type: 'DEFEAT_MONSTER',
			playerId: CLASSIC_TUTORIAL_PLAYER_ID,
			monsterId: 'pincher',
		}
		state = applyLessonAction(state, 'defeat-pincher', defeat)
		expect(getPlayerScore(state, CLASSIC_TUTORIAL_PLAYER_ID, CORE_CATALOG)).toBe(2)
		expect(state.turn.currentPlayerId).toBe(CLASSIC_TUTORIAL_PLAYER_ID)

		const handCountBeforeEndTurn = state.players[0].hand.length
		state = applyLessonAction(state, 'end-turn', {
			type: 'SKIP_TURN',
			playerId: CLASSIC_TUTORIAL_PLAYER_ID,
		})
		expect(state.turn.currentPlayerId).toBe(CLASSIC_TUTORIAL_PLAYER_ID)
		expect(state.players[0].hand).toHaveLength(handCountBeforeEndTurn + 1)

		const blackHole = state.players[0].hand.find((card) => card.definitionId === 'black-hole')!
		state = applyLessonAction(state, 'use-black-hole', {
			type: 'USE_ULTIMATE_WEAPON',
			playerId: CLASSIC_TUTORIAL_PLAYER_ID,
			cardInstanceId: blackHole.instanceId,
			monsterId: 'thing',
		})

		expect(validateGameState(state)).toMatchObject({ valid: true, errors: [] })
		expect(getPlayerScore(state, CLASSIC_TUTORIAL_PLAYER_ID, CORE_CATALOG)).toBe(5)
		expect(state.turn.currentPlayerId).toBe('trainer')
		expect(state.discardPile).toContainEqual(blackHole)
	})

	it('rejects an action that does not belong to the current lesson', () => {
		const state = createClassicTutorialState('Rowan')
		const skip: GameAction = { type: 'SKIP_TURN', playerId: CLASSIC_TUTORIAL_PLAYER_ID }

		expect(matchesTutorialAction(state, skip, CLASSIC_TUTORIAL_LESSONS[1])).toBe(false)
	})
})
