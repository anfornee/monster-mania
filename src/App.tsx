import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import './App.css'
import { CardGallery } from './components/cards/CardGallery'
import { GameBootScreen } from './components/game/GameBootScreen'
import { GameBoard } from './components/game/GameBoard'
import { OnlineLobby } from './components/game/OnlineLobby'
import { RulesSandbox } from './dev/RulesSandbox'
import { chooseComputerAction } from './game/ai/computerStrategy'
import {
	GAME_ASSET_PATHS,
	GAMEPLAY_ASSETS,
	MENU_CRITICAL_ASSETS,
} from './game/assets/assetManifest'
import { preloadAssets } from './game/assets/preloadAssets'
import { useAssetPreloader } from './game/assets/useAssetPreloader'
import { CORE_CATALOG } from './game/definitions/core'
import { applyGameAction } from './game/engine/applyGameAction'
import { createGame } from './game/engine/createGame'
import type { GameAction, GameState } from './game/engine/types'
import { validateGameState } from './game/engine/validateGameState'
import { loadOnlineTableSession } from './game/network/firebase/tableSessionStorage'
import { GAME_TIMING, getComputerActionDelay } from './game/presentation/aiPacing'
import {
	getActionPresentationSteps,
	type GamePresentationStep,
} from './game/presentation/presentationSequence'
import {
	loadPlayerName,
	normalizePlayerName,
	PLAYER_NAME_MAX_LENGTH,
	savePlayerName,
	validatePlayerName,
} from './game/presentation/playerProfile'
import {
	GAME_STORAGE_KEY,
	isResumableGame,
	restoreGame,
	serializeGame,
} from './game/serialization/gameStorage'

type AppScreen = 'home' | 'setup' | 'solo' | 'online'

function createSoloGame(playerName: string): GameState {
	return createGame({
		seed: Date.now(),
		startingPlayerId: 'player',
		players: [
			{ id: 'player', name: playerName, controller: 'human-local' },
			{ id: 'computer', name: 'Mayhem Bot', controller: 'computer' },
		],
	})
}

function loadSavedSoloGame(playerName: string): GameState | null {
	try {
		const value = localStorage.getItem(GAME_STORAGE_KEY)
		const restored = value ? restoreGame(value) : null
		if (!isResumableGame(restored)) {
			localStorage.removeItem(GAME_STORAGE_KEY)
			return null
		}
		const localPlayer = restored.players.find((player) => player.controller === 'human-local')
		if (localPlayer?.name !== 'You') return restored
		const personalized = structuredClone(restored)
		const personalizedPlayer = personalized.players.find((player) => player.id === localPlayer.id)!
		personalizedPlayer.name = playerName
		personalized.events = personalized.events.map((event) => ({
			...event,
			message: event.message.replace(/^You(?=\s|'s)/, playerName),
		}))
		return personalized
	} catch {
		return null
	}
}

function HomeScreen({ hasSavedGame, onPlaySolo, onResume, onOpenOnline }: {
	hasSavedGame: boolean
	onPlaySolo: () => void
	onResume: () => void
	onOpenOnline: () => void
}) {
	return (
		<main className="home-screen">
			<div className="home-scrim" />
			<nav className="home-nav" aria-label="Primary navigation">
				<img src={GAME_ASSET_PATHS.logo} alt="Monster Mania" />
				<div className="home-nav-links">
					<a href="/cards">Card gallery</a>
					<a href="/dev/rules">Rules &amp; Sandbox</a>
				</div>
			</nav>
			<section className="tavern-hero" aria-labelledby="home-title">
				<div className="hero-copy">
					<span className="eyebrow">The hunters' tavern is open</span>
					<h1 id="home-title">Pull up a chair.<br />Bring on the monsters.</h1>
					<p>Build your hand, match the right Weapons, and outscore your rival before The Infinity Beast crashes the party.</p>
					<div className="hero-actions">
						<button type="button" className="primary-button" onClick={onPlaySolo}>Play Solo</button>
						{hasSavedGame ? <button type="button" className="secondary-button" onClick={onResume}>Resume match</button> : null}
					</div>
					<div className="home-modes" aria-label="Game modes">
						<div><strong>Solo Game</strong><span>Ready to play</span></div>
						<button type="button" onClick={onOpenOnline}><strong>Online Table</strong><span>Lobby available</span></button>
					</div>
				</div>
			</section>
			<p className="home-world-note">Beyond the ridge, the Infinity Beast is stirring.</p>
		</main>
	)
}

function NameSetup({ initialName, onBack, onStart }: {
	initialName: string
	onBack: () => void
	onStart: (name: string) => void
}) {
	const [name, setName] = useState(initialName)
	const [showError, setShowError] = useState(false)
	const error = validatePlayerName(name)
	return (
		<main className="setup-screen">
			<div className="setup-card">
				<img src={GAME_ASSET_PATHS.logo} alt="Monster Mania" />
				<span className="eyebrow">Before you enter the tavern</span>
				<h1>What should the hunters call you?</h1>
				<p>This name appears in the match journal. You can change it before any new game.</p>
				<form onSubmit={(event) => {
					event.preventDefault()
					if (error) {
						setShowError(true)
						return
					}
					onStart(normalizePlayerName(name))
				}}>
					<label htmlFor="player-name">Your name</label>
					<input
						id="player-name"
						value={name}
						maxLength={PLAYER_NAME_MAX_LENGTH}
						autoComplete="nickname"
						autoFocus
						aria-describedby={showError && error ? 'player-name-error' : 'player-name-hint'}
						aria-invalid={showError && Boolean(error)}
						onChange={(event) => {
							setName(event.target.value)
							setShowError(false)
						}}
					/>
					{showError && error ? <span id="player-name-error" className="field-error">{error}</span> : <span id="player-name-hint" className="field-hint">2–{PLAYER_NAME_MAX_LENGTH} characters</span>}
					<div className="setup-actions">
						<button type="submit" className="primary-button">Start game</button>
						<button type="button" className="secondary-button" onClick={onBack}>Back</button>
					</div>
			</form>
			</div>
		</main>
	)
}

function GameApplication() {
	const [screen, setScreen] = useState<AppScreen>(() => (
		loadOnlineTableSession(window.localStorage) ? 'online' : 'home'
	))
	const [game, setGame] = useState<GameState | null>(null)
	const [playerName, setPlayerName] = useState(() => loadPlayerName(localStorage))
	const [savedGame, setSavedGame] = useState<GameState | null>(() => loadSavedSoloGame(playerName))
	const [error, setError] = useState<string | null>(null)
	const [handoffLocked, setHandoffLocked] = useState(false)
	const [pendingPresentation, setPendingPresentation] = useState<{
		nextState: GameState
		steps: GamePresentationStep[]
		stepIndex: number
		stateCommitted: boolean
		handoffToHuman: boolean
	} | null>(null)
	const aiTurnKey = useRef<string | null>(null)
	const decisionPlayerId = game?.pendingDiscard?.playerId ?? game?.turn.currentPlayerId
	const decisionPlayer = game?.players.find((player) => player.id === decisionPlayerId)
	const presentationStep = pendingPresentation?.steps[pendingPresentation.stepIndex] ?? null
	const actionsResolving = handoffLocked || Boolean(pendingPresentation) || decisionPlayer?.controller === 'computer'

	const commitGameState = useCallback((nextState: GameState, handoffToHuman = false) => {
		if (handoffToHuman && nextState.phase !== 'game-over') setHandoffLocked(true)
		setError(null)
		setGame(nextState)
		setSavedGame(isResumableGame(nextState) ? nextState : null)
	}, [])

	const beginAcceptedTransition = useCallback((
		before: GameState,
		action: GameAction,
		nextState: GameState,
	) => {
		const steps = getActionPresentationSteps(before, nextState, action, 'player', CORE_CATALOG)
		const actor = before.players.find((player) => player.id === action.playerId)
		const nextDecisionId = nextState.pendingDiscard?.playerId ?? nextState.turn.currentPlayerId
		const nextDecisionPlayer = nextState.players.find((player) => player.id === nextDecisionId)
		const handoffToHuman = actor?.controller === 'computer' && nextDecisionPlayer?.controller !== 'computer'
		if (steps.length === 0) {
			commitGameState(nextState, handoffToHuman)
			return
		}
		const stateCommitted = steps[0].type === 'announcement'
		if (stateCommitted) commitGameState(nextState, handoffToHuman)
		setPendingPresentation({ nextState, steps, stepIndex: 0, stateCommitted, handoffToHuman })
	}, [commitGameState])

	const completePresentationStep = useCallback(() => {
		if (!pendingPresentation) return
		const nextIndex = pendingPresentation.stepIndex + 1
		const nextStep = pendingPresentation.steps[nextIndex]
		let stateCommitted = pendingPresentation.stateCommitted
		if (!stateCommitted && (!nextStep || nextStep.type === 'announcement')) {
			commitGameState(pendingPresentation.nextState, pendingPresentation.handoffToHuman)
			stateCommitted = true
		}
		if (!nextStep) {
			setPendingPresentation(null)
			return
		}
		setPendingPresentation({
			...pendingPresentation,
			stepIndex: nextIndex,
			stateCommitted,
		})
	}, [commitGameState, pendingPresentation])

	useEffect(() => {
		if (!game) return
		try {
			if (isResumableGame(game)) {
				localStorage.setItem(GAME_STORAGE_KEY, serializeGame(game))
			} else {
				localStorage.removeItem(GAME_STORAGE_KEY)
			}
		} catch {
			// The current match remains playable when browser storage is unavailable.
		}
	}, [game])

	useEffect(() => {
		if (!handoffLocked) return
		const handoff = window.setTimeout(() => setHandoffLocked(false), GAME_TIMING.aiHandoff)
		return () => window.clearTimeout(handoff)
	}, [handoffLocked])

	useEffect(() => {
		if (!game || game.phase === 'game-over') {
			aiTurnKey.current = null
			return
		}
		if (pendingPresentation) return
		const decisionPlayerId = game.pendingDiscard?.playerId ?? game.turn.currentPlayerId
		const decisionPlayer = game.players.find((player) => player.id === decisionPlayerId)
		if (decisionPlayer?.controller !== 'computer') {
			aiTurnKey.current = null
			return
		}

		const turnKey = `${game.turn.number}:${decisionPlayer.id}`
		const firstAction = aiTurnKey.current !== turnKey
		aiTurnKey.current = turnKey
		const timeout = window.setTimeout(() => {
			const action = chooseComputerAction(game, decisionPlayer.id, CORE_CATALOG)
			if (!action) return
			const result = applyGameAction(game, action, CORE_CATALOG)
			if (!result.ok) {
				setError(result.error ?? 'The computer could not complete its action.')
				return
			}
			if (import.meta.env.DEV) {
				const validation = validateGameState(result.state)
				if (!validation.valid) {
					setError(`Development validation blocked an invalid computer state: ${validation.errors.join(' ')}`)
					return
				}
			}
			beginAcceptedTransition(game, action, result.state)
		}, getComputerActionDelay(game, firstAction))
		return () => window.clearTimeout(timeout)
	}, [beginAcceptedTransition, game, pendingPresentation])

	if (window.location.pathname === '/dev/rules') return <RulesSandbox />
	if (window.location.pathname === '/cards') return <CardGallery catalog={CORE_CATALOG} />

	const beginSolo = (name: string) => {
		const savedName = savePlayerName(localStorage, name)
		const freshGame = createSoloGame(savedName)
		setPlayerName(savedName)
		setGame(freshGame)
		setSavedGame(freshGame)
		setScreen('solo')
		setError(null)
		setHandoffLocked(false)
		setPendingPresentation(null)
		aiTurnKey.current = null
	}

	const dispatch = (action: GameAction) => {
		if (!game || actionsResolving) return
		const result = applyGameAction(game, action)
		if (!result.ok) {
			setError(result.error ?? 'That move is not legal.')
			return
		}
		if (import.meta.env.DEV) {
			const validation = validateGameState(result.state)
			if (!validation.valid) {
				setError(`Development validation blocked an invalid game state: ${validation.errors.join(' ')}`)
				return
			}
		}
		beginAcceptedTransition(game, action, result.state)
	}

	if (screen === 'setup') return <NameSetup initialName={playerName} onBack={() => setScreen('home')} onStart={beginSolo} />
	if (screen === 'online') return <OnlineLobby initialPlayerName={playerName} onBack={() => setScreen('home')} />
	if (screen === 'solo' && game) {
		return (
			<div className="game-shell">
				<nav className="game-topbar" aria-label="Match navigation">
					<button type="button" className="back-button" onClick={() => {
						setPendingPresentation(null)
						aiTurnKey.current = null
						setScreen('home')
					}}>← Tavern</button>
					<img src={GAME_ASSET_PATHS.logo} alt="Monster Mania" />
					<button type="button" onClick={() => {
						setPendingPresentation(null)
						aiTurnKey.current = null
						setScreen('setup')
					}}>New game</button>
				</nav>
				{error ? <div className="error-banner" role="alert">{error}</div> : null}
				<GameBoard
					state={game}
					localPlayerId="player"
					onAction={dispatch}
					actionsResolving={actionsResolving}
					presentationStep={presentationStep}
					onPresentationComplete={completePresentationStep}
					onPlayAgain={() => beginSolo(playerName)}
					onReturnToMenu={() => {
						setPendingPresentation(null)
						setGame(null)
						setScreen('home')
					}}
				/>
			</div>
		)
	}

	const resumableGame = isResumableGame(game) ? game : savedGame
	return <HomeScreen hasSavedGame={Boolean(resumableGame)} onPlaySolo={() => setScreen('setup')} onResume={() => {
		if (resumableGame) {
			setGame(resumableGame)
			setScreen('solo')
		}
	}} onOpenOnline={() => setScreen('online')} />
}

const APP_ASSET_STYLES = {
	'--menu-background-image': `url("${GAME_ASSET_PATHS.menuBackground}")`,
	'--board-background-image': `url("${GAME_ASSET_PATHS.boardBackground}")`,
	'--card-back-image': `url("${GAME_ASSET_PATHS.cardBack}")`,
} as CSSProperties

const BOOT_MINIMUM_MS = 360
const BOOT_FADE_MS = 320

function App() {
	const { status, progress, retry } = useAssetPreloader(MENU_CRITICAL_ASSETS)
	const [bootPhase, setBootPhase] = useState<'visible' | 'leaving' | 'done'>('visible')
	const [bootStartedAt] = useState(() => performance.now())
	const contentVisible = bootPhase !== 'visible'

	useEffect(() => {
		if (status !== 'ready' || bootPhase !== 'visible') return
		const elapsed = performance.now() - bootStartedAt
		const revealTimer = window.setTimeout(
			() => setBootPhase('leaving'),
			Math.max(0, BOOT_MINIMUM_MS - elapsed),
		)
		return () => window.clearTimeout(revealTimer)
	}, [bootPhase, bootStartedAt, status])

	useEffect(() => {
		if (bootPhase !== 'leaving') return
		const removalTimer = window.setTimeout(() => setBootPhase('done'), BOOT_FADE_MS)
		return () => window.clearTimeout(removalTimer)
	}, [bootPhase])

	useEffect(() => {
		if (!contentVisible) return
		let active = true
		const idleWindow = window as Window & {
			requestIdleCallback?: (callback: () => void) => number
			cancelIdleCallback?: (handle: number) => void
		}
		const warmGameplayAssets = () => {
			void preloadAssets(GAMEPLAY_ASSETS).then((result) => {
				if (active && result.failures.length > 0) {
					console.warn('Some gameplay art could not be preloaded.', result.failures)
				}
			})
		}
		const idleHandle = idleWindow.requestIdleCallback
			? idleWindow.requestIdleCallback(warmGameplayAssets)
			: window.setTimeout(warmGameplayAssets, 0)
		return () => {
			active = false
			if (idleWindow.cancelIdleCallback) idleWindow.cancelIdleCallback(idleHandle)
			else window.clearTimeout(idleHandle)
		}
	}, [contentVisible])

	return (
		<div className={`app-runtime${contentVisible ? ' content-visible' : ''}`} style={APP_ASSET_STYLES}>
			{contentVisible ? <GameApplication /> : null}
			{bootPhase !== 'done' ? (
				<GameBootScreen
					status={status}
					progress={progress}
					leaving={bootPhase === 'leaving'}
					onRetry={retry}
				/>
			) : null}
		</div>
	)
}

export default App
