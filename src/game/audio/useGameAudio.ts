import { useEffect } from 'react'
import type { PlayerId } from '../definitions/types'
import type { GameState } from '../engine/types'
import { useOptionalAudioManager } from './audioContext'

export function useGameAudio(state: GameState, localPlayerId: PlayerId): void {
	const manager = useOptionalAudioManager()

	useEffect(() => {
		manager?.syncGameState(state, localPlayerId)
	}, [localPlayerId, manager, state])

	useEffect(() => () => manager?.playMenuMusic(), [manager])
}
