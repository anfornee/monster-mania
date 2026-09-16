import { createContext, useContext } from 'react'
import type { AudioManager } from './AudioManager'

export interface AudioContextValue {
	manager: AudioManager
	enabled: boolean
	setEnabled: (enabled: boolean) => void
}

export const AudioContext = createContext<AudioContextValue | null>(null)

export function useAudio(): AudioContextValue {
	const context = useContext(AudioContext)
	if (!context) throw new Error('useAudio must be used inside AudioProvider.')
	return context
}

export function useOptionalAudioManager(): AudioManager | null {
	return useContext(AudioContext)?.manager ?? null
}
