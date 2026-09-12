import { useEffect, useState } from 'react'
import './App.css'
import { GameBoard } from './components/game/GameBoard'
import { RulesSandbox } from './dev/RulesSandbox'
import { runComputerTurn } from './game/ai'
import { CORE_CATALOG } from './game/definitions/core'
import { applyGameAction } from './game/engine/applyGameAction'
import { createGame } from './game/engine/createGame'
import type { GameAction, GameState } from './game/engine/types'
import { validateGameState } from './game/engine/validateGameState'
import { GAME_STORAGE_KEY, restoreGame, serializeGame } from './game/serialization/gameStorage'

type AppScreen = 'home' | 'solo' | 'online'

function createSoloGame(): GameState {
	return createGame({
		seed: Date.now(),
		startingPlayerId: 'player',
		players: [
			{ id: 'player', name: 'You', controller: 'human-local' },
			{ id: 'computer', name: 'Mayhem Bot', controller: 'computer' },
		],
	})
}

function loadSavedSoloGame(): GameState | null {
	try {
		const value = localStorage.getItem(GAME_STORAGE_KEY)
		return value ? restoreGame(value) : null
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
			<nav className="home-nav" aria-label="Primary navigation">
				<img src="/assets/logo.png" alt="Monster Mania" />
				<a href="/dev/rules">Rules Sandbox</a>
			</nav>
			<section className="hero-section">
				<div className="hero-copy">
					<span className="eyebrow">Cards. Creatures. Total mayhem.</span>
					<h1>Build your hand.<br />Beat the monsters.</h1>
					<p>Chain powerful Actions, match the right Weapons, and outscore your rival before The Infinity Beast crashes the party.</p>
					<div className="hero-actions">
						<button type="button" className="primary-button" onClick={onPlaySolo}>Play Solo</button>
						{hasSavedGame ? <button type="button" className="secondary-button" onClick={onResume}>Resume game</button> : null}
					</div>
				</div>
				<div className="hero-cards" aria-hidden="true">
					<img src="/assets/cards/monsters/the-infinity-beast-card.jpg" alt="" />
					<img src="/assets/cards/weapons/sword-card.jpg" alt="" />
					<img src="/assets/cards/monsters/thing-card.jpg" alt="" />
				</div>
			</section>
			<section className="mode-grid" aria-labelledby="choose-mode">
				<div>
					<span className="eyebrow">Choose your challenge</span>
					<h2 id="choose-mode">Two ways to enter the arena</h2>
				</div>
				<article className="mode-card">
					<span className="mode-number">01</span><h3>Solo Game</h3>
					<p>Face Mayhem Bot in a complete match powered by the same rules as every mode.</p>
					<button type="button" onClick={onPlaySolo}>Start a Solo Game <span aria-hidden="true">→</span></button>
				</article>
				<article className="mode-card online-mode">
					<span className="mode-number">02</span><h3>Online Table</h3>
					<p>The private Table interface is scaffolded for the future authoritative server.</p>
					<button type="button" onClick={onOpenOnline}>View Table setup <span aria-hidden="true">→</span></button>
				</article>
			</section>
		</main>
	)
}

function OnlineSkeleton({ onBack }: { onBack: () => void }) {
	const [code, setCode] = useState('')
	return (
		<main className="online-shell">
			<button type="button" className="back-button" onClick={onBack}>← Back</button>
			<section className="online-panel">
				<span className="eyebrow">Online Table · integration skeleton</span>
				<h1>Play together from separate devices</h1>
				<p>The typed Table service, action protocol, privacy filter, and server-validation boundary are ready. A deployed realtime backend and identity store are not configured yet.</p>
				<div className="table-options">
					<div>
						<h2>Create Table</h2>
						<p>Future flow: create a private two-seat Table and share its short code.</p>
						<button type="button" disabled title="Requires the future Online Table backend">Create Table</button>
					</div>
					<form onSubmit={(event) => event.preventDefault()}>
						<h2>Join Table</h2>
						<label htmlFor="table-code">Table code</label>
						<input id="table-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase().slice(0, 5))} placeholder="AB7KQ" autoComplete="off" />
						<button type="submit" disabled title="Requires the future Online Table backend">Join Table</button>
					</form>
				</div>
				<p className="implementation-note">See <code>docs/online-table-implementation-guide.md</code> for the production implementation plan.</p>
			</section>
		</main>
	)
}

function App() {
	const [screen, setScreen] = useState<AppScreen>('home')
	const [game, setGame] = useState<GameState | null>(null)
	const [savedGame] = useState<GameState | null>(() => loadSavedSoloGame())
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (!game) return
		try {
			localStorage.setItem(GAME_STORAGE_KEY, serializeGame(game))
		} catch {
			// The current match remains playable when browser storage is unavailable.
		}
	}, [game])

	useEffect(() => {
		if (!game || game.phase === 'game-over') return
		const decisionPlayerId = game.pendingDiscard?.playerId ?? game.turn.currentPlayerId
		const decisionPlayer = game.players.find((player) => player.id === decisionPlayerId)
		if (decisionPlayer?.controller !== 'computer') return
		const timeout = window.setTimeout(() => {
			const result = runComputerTurn(game, decisionPlayer.id, CORE_CATALOG)
			if (!result.ok) {
				setError(result.error ?? 'The computer could not complete its turn.')
				return
			}
			if (import.meta.env.DEV) {
				const validation = validateGameState(result.state)
				if (!validation.valid) {
					setError(`Development validation blocked an invalid computer state: ${validation.errors.join(' ')}`)
					return
				}
			}
			setGame(result.state)
		}, 550)
		return () => window.clearTimeout(timeout)
	}, [game])

	if (window.location.pathname === '/dev/rules') return <RulesSandbox />

	const startSolo = () => {
		setGame(createSoloGame())
		setScreen('solo')
		setError(null)
	}
	const dispatch = (action: GameAction) => {
		if (!game) return
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
		setError(null)
		setGame(result.state)
	}

	if (screen === 'online') return <OnlineSkeleton onBack={() => setScreen('home')} />
	if (screen === 'solo' && game) {
		return (
			<div className="game-shell">
				<div className="game-topbar">
					<button type="button" className="back-button" onClick={() => setScreen('home')}>← Home</button>
					<span>Solo Game</span>
					<button type="button" onClick={startSolo}>New game</button>
				</div>
				{error ? <div className="error-banner" role="alert">{error}</div> : null}
				<GameBoard state={game} localPlayerId="player" onAction={dispatch} />
			</div>
		)
	}

	const resumableGame = game ?? savedGame
	return <HomeScreen hasSavedGame={Boolean(resumableGame)} onPlaySolo={startSolo} onResume={() => {
		if (resumableGame) {
			setGame(resumableGame)
			setScreen('solo')
		}
	}} onOpenOnline={() => setScreen('online')} />
}

export default App
