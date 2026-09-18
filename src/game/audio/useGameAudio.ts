import { useEffect } from 'react'
import type { PlayerId } from '../definitions/types'
import type { GameState } from '../engine/types'
import { useOptionalAudioManager } from './audioContext'

export function useGameAudio(
	state: GameState,
	localPlayerId: PlayerId,
	resultPresented: boolean,
): void {
	const manager = useOptionalAudioManager()

	useEffect(() => {
		manager?.syncGameState(state, localPlayerId, resultPresented)
	}, [localPlayerId, manager, resultPresented, state])

	useEffect(() => () => manager?.playMenuMusic(), [manager])
}
