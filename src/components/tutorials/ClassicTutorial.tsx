import { useCallback, useState } from 'react'
import { SettingsControl } from '../SettingsControl'
import { GameBoard } from '../game/GameBoard'
import { CORE_CATALOG } from '../../game/definitions/core'
import { applyGameAction } from '../../game/engine/applyGameAction'
import type { GameAction } from '../../game/engine/types'
import { validateGameState } from '../../game/engine/validateGameState'
import {
	CLASSIC_TUTORIAL_LESSONS,
	CLASSIC_TUTORIAL_PLAYER_ID,
	createClassicTutorialState,
	matchesTutorialAction,
} from '../../game/tutorials/classicTutorial'

interface ClassicTutorialProps {
	playerName: string
	onExit: () => void
	onComplete: () => void
}

export function ClassicTutorial({ playerName, onExit, onComplete }: ClassicTutorialProps) {
	const [state, setState] = useState(() => createClassicTutorialState(playerName))
	const [lessonIndex, setLessonIndex] = useState(0)
	const [error, setError] = useState<string | null>(null)
	const complete = lessonIndex >= CLASSIC_TUTORIAL_LESSONS.length
	const lesson = CLASSIC_TUTORIAL_LESSONS[lessonIndex]

	const isActionAllowed = useCallback((action: GameAction) => (
		Boolean(lesson) && matchesTutorialAction(state, action, lesson)
	), [lesson, state])

	const advanceLesson = () => {
		const nextIndex = lessonIndex + 1
		setLessonIndex(nextIndex)
		if (nextIndex === CLASSIC_TUTORIAL_LESSONS.length) onComplete()
	}

	const dispatch = (action: GameAction) => {
		if (!lesson || !matchesTutorialAction(state, action, lesson)) return
		const result = applyGameAction(state, action, CORE_CATALOG)
		if (!result.ok) {
			setError(result.error ?? 'That training move could not be completed.')
			return
		}
		let nextState = result.state
		for (const followUpAction of lesson.followUpActions ?? []) {
			const followUpResult = applyGameAction(nextState, followUpAction, CORE_CATALOG)
			if (!followUpResult.ok) {
				setError(followUpResult.error ?? 'The Guild Trainer could not complete the lesson handoff.')
				return
			}
			nextState = followUpResult.state
		}
		const validation = validateGameState(nextState, CORE_CATALOG)
		if (!validation.valid) {
			setError(`Training state could not continue: ${validation.errors.join(' ')}`)
			return
		}
		setError(null)
		setState(nextState)
		advanceLesson()
	}

	const restart = () => {
		setState(createClassicTutorialState(playerName))
		setLessonIndex(0)
		setError(null)
	}

	if (complete) {
		return (
			<main className="tutorial-complete-page">
				<section className="tutorial-complete-card" aria-labelledby="training-complete-title">
					<span className="eyebrow">Classic training complete</span>
					<h1 id="training-complete-title">Your first hunt is in the books.</h1>
					<p>You played and chained Actions, resolved a required discard, learned when to end a turn, and finished the hunt with an Ultimate Weapon. Training remains available whenever you want to replay it.</p>
					<div className="tutorial-complete-actions">
						<button type="button" className="primary-button" onClick={onExit}>Return to Tutorials</button>
						<button type="button" className="secondary-button" onClick={restart}>Replay Classic</button>
					</div>
				</section>
			</main>
		)
	}

	return (
		<div className="tutorial-session-shell">
			<nav className="game-topbar tutorial-topbar" aria-label="Training navigation">
				<button type="button" className="back-button" onClick={onExit}>← Exit training</button>
				<strong>Classic Training</strong>
				<SettingsControl />
			</nav>
			<section className="tutorial-lesson-panel" aria-labelledby="tutorial-lesson-title" aria-live="polite">
				<div className="tutorial-lesson-progress" aria-label={`Lesson ${lessonIndex + 1} of ${CLASSIC_TUTORIAL_LESSONS.length}`}>
					<span style={{ width: `${((lessonIndex + 1) / CLASSIC_TUTORIAL_LESSONS.length) * 100}%` }} />
				</div>
				<div className="tutorial-lesson-copy">
					<span className="eyebrow">Lesson {lessonIndex + 1} of {CLASSIC_TUTORIAL_LESSONS.length}</span>
					<h1 id="tutorial-lesson-title">{lesson.title}</h1>
					<p>{lesson.instruction}</p>
					<small>{lesson.hint}</small>
					{error ? <span className="field-error" role="alert">{error}</span> : null}
				</div>
				{lesson.requiredAction === null ? (
					<button type="button" className="primary-button" onClick={advanceLesson}>Continue</button>
				) : (
					<span className="tutorial-awaiting-action">Your move</span>
				)}
			</section>
			<GameBoard
				state={state}
				localPlayerId={CLASSIC_TUTORIAL_PLAYER_ID}
				onAction={dispatch}
				isActionAllowed={isActionAllowed}
			/>
		</div>
	)
}
