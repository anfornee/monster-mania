import { useMemo, useState } from 'react'
import { GameBoard } from '../components/game/GameBoard'
import { applyGameAction } from '../game/engine/applyGameAction'
import type { GameAction } from '../game/engine/types'
import { validateGameState } from '../game/engine/validateGameState'
import {
	createSandboxScenario,
	SANDBOX_PRESETS,
	type SandboxPreset,
} from '../game/sandbox/presets'

export function RulesSandbox() {
	const [preset, setPreset] = useState<SandboxPreset>('fresh-game')
	const [scenario, setScenario] = useState(() => createSandboxScenario('fresh-game'))
	const [lastError, setLastError] = useState<string | null>(null)
	const validation = useMemo(
		() => validateGameState(scenario.state, scenario.catalog),
		[scenario],
	)

	const loadPreset = (nextPreset: SandboxPreset) => {
		setPreset(nextPreset)
		setScenario(createSandboxScenario(nextPreset))
		setLastError(null)
	}
	const dispatch = (action: GameAction) => {
		const result = applyGameAction(scenario.state, action, scenario.catalog)
		if (!result.ok) {
			setLastError(result.error ?? 'Action rejected.')
			return
		}
		setLastError(null)
		setScenario((current) => ({ ...current, state: result.state }))
	}

	return (
		<div className="sandbox-shell">
			<header className="sandbox-toolbar">
				<div>
					<a href="/">← Home</a>
					<h1>Rules Sandbox</h1>
					<p>Deterministic legal states for engine and UI checks.</p>
				</div>
				<label>
					Preset
					<select value={preset} onChange={(event) => loadPreset(event.target.value as SandboxPreset)}>
						{SANDBOX_PRESETS.map((name) => <option key={name} value={name}>{name}</option>)}
					</select>
				</label>
			</header>
			<div className={`validation-banner ${validation.valid ? 'valid' : 'invalid'}`} role="status">
				<strong>{validation.valid ? 'Valid game state' : 'Invalid game state'}</strong>
				<span>{scenario.description}</span>
				{lastError ? <span>Last action rejected: {lastError}</span> : null}
				{validation.errors.map((error) => <span key={error}>{error}</span>)}
			</div>
			<GameBoard
				state={scenario.state}
				catalog={scenario.catalog}
				localPlayerId={scenario.state.pendingDiscard?.playerId ?? scenario.state.turn.currentPlayerId}
				onAction={dispatch}
				compact
			/>
			<details className="raw-state">
				<summary>Raw serialized GameState</summary>
				<pre>{JSON.stringify(scenario.state, null, 2)}</pre>
			</details>
		</div>
	)
}
