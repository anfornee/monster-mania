import { useState } from 'react'
import { SettingsControl } from '../SettingsControl'
import { getTutorialModeStatus, TUTORIAL_MODES } from '../../game/tutorials/tutorialCatalog'
import type { TutorialModeId, TutorialProgress } from '../../game/tutorials/types'

interface TutorialsPageProps {
	progress: TutorialProgress
	onBack: () => void
	onStartTutorial: (modeId: TutorialModeId, entryPoint: string) => void
}

const STATUS_LABELS = {
	'not-started': 'Ready to learn',
	completed: 'Completed · Replay anytime',
	'coming-soon': 'Coming Soon',
} as const

export function TutorialsPage({ progress, onBack, onStartTutorial }: TutorialsPageProps) {
	const [selectedModeId, setSelectedModeId] = useState<TutorialModeId | null>(null)
	const selectedMode = TUTORIAL_MODES.find((mode) => mode.id === selectedModeId) ?? null

	return (
		<main className="tutorials-page">
			<nav className="tutorials-nav" aria-label="Tutorial navigation">
				<button type="button" className="back-button" onClick={onBack}>← Tavern</button>
				<span>Hunter's Training</span>
				<SettingsControl />
			</nav>
			<header className="tutorials-header">
				<span className="eyebrow">Hunter's Training</span>
				<h1>Choose your game.</h1>
				<p>Learn Monster Mania at your own pace. Training stays available after completion, so every lesson can be replayed whenever you want a refresher.</p>
			</header>
			<section className="tutorial-mode-grid" aria-labelledby="tutorial-mode-heading">
				<h2 id="tutorial-mode-heading" className="sr-only">Choose a game mode</h2>
				{TUTORIAL_MODES.map((mode) => {
					const status = getTutorialModeStatus(mode, progress)
					const content = (
						<>
							<span className="tutorial-mode-status">{STATUS_LABELS[status]}</span>
							<strong>{mode.displayName}</strong>
							<p>{mode.description}</p>
							{mode.availability === 'available' ? <small>Choose mode →</small> : null}
						</>
					)
					if (mode.availability === 'available') {
						return (
							<button
								type="button"
								key={mode.id}
								className={`tutorial-mode-card${selectedModeId === mode.id ? ' selected' : ''}`}
								aria-pressed={selectedModeId === mode.id}
								onClick={() => setSelectedModeId(mode.id)}
							>
								{content}
							</button>
						)
					}
					return <article key={mode.id} className="tutorial-mode-card unavailable" aria-label={`${mode.displayName}, Coming Soon`}>{content}</article>
				})}
			</section>
			{selectedMode?.availability === 'available' && selectedMode.tutorialEntryPoint ? (
				<section className="tutorial-start-panel" aria-live="polite">
					<div>
						<span className="eyebrow">Selected training</span>
						<h2>{selectedMode.displayName}</h2>
						<p>{selectedMode.lessons.length} guided lessons · progress is informational and never locks normal play.</p>
					</div>
					<button
						type="button"
						className="primary-button"
						onClick={() => onStartTutorial(selectedMode.id, selectedMode.tutorialEntryPoint!)}
					>
						{progress.completed[selectedMode.id] ? 'Replay Tutorial' : 'Start Tutorial'}
					</button>
				</section>
			) : null}
		</main>
	)
}
