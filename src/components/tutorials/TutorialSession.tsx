import type { TutorialModeId } from '../../game/tutorials/types'
import { getTutorialMode } from '../../game/tutorials/tutorialCatalog'
import { ClassicTutorial } from './ClassicTutorial'

interface TutorialSessionProps {
	modeId: TutorialModeId
	playerName: string
	onExit: () => void
	onComplete: (modeId: TutorialModeId) => void
}

export function TutorialSession({ modeId, playerName, onExit, onComplete }: TutorialSessionProps) {
	const mode = getTutorialMode(modeId)
	if (mode.availability !== 'available') return null

	switch (mode.id) {
		case 'classic':
			return (
				<ClassicTutorial
					playerName={playerName}
					onExit={onExit}
					onComplete={() => onComplete(mode.id)}
				/>
			)
		case 'ritual':
		case 'chaos':
			return null
	}
}
