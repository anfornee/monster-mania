import {
	useCallback,
	useEffect,
	useState,
	type ReactNode,
} from 'react'
import { AudioManager } from './AudioManager'
import { AudioContext } from './audioContext'
import { loadAudioEnabled, saveAudioEnabled } from './audioPreference'
import { HowlerPlaybackBackend } from './audioPlayback'

export function AudioProvider({ children }: { children: ReactNode }) {
	const [enabled, setEnabledState] = useState(() => loadAudioEnabled(window.localStorage))
	const [manager] = useState(() => new AudioManager(
		new HowlerPlaybackBackend(),
		{ enabled },
	))

	useEffect(() => {
		if (!enabled) return
		manager.prepareCriticalSfx()
		// Try the menu scene as soon as the boot screen hands off to the app.
		// Browsers that require a gesture will reject this attempt; Howler keeps
		// the active sound ready to retry when the listener below receives one.
		manager.unlock()
		const unlock = () => {
			manager.unlock()
			document.removeEventListener('pointerdown', unlock, true)
			document.removeEventListener('keydown', unlock, true)
		}
		document.addEventListener('pointerdown', unlock, { capture: true })
		document.addEventListener('keydown', unlock, { capture: true })
		return () => {
			document.removeEventListener('pointerdown', unlock, true)
			document.removeEventListener('keydown', unlock, true)
		}
	}, [enabled, manager])

	useEffect(() => {
		const handleVisibility = () => manager.handleVisibilityChange(!document.hidden)
		document.addEventListener('visibilitychange', handleVisibility)
		return () => document.removeEventListener('visibilitychange', handleVisibility)
	}, [manager])

	useEffect(() => () => manager.dispose(), [manager])

	const setEnabled = useCallback((nextEnabled: boolean) => {
		setEnabledState(nextEnabled)
		saveAudioEnabled(window.localStorage, nextEnabled)
		manager.setEnabled(nextEnabled)
		if (nextEnabled) manager.unlock()
	}, [manager])

	return (
		<AudioContext.Provider value={{ manager, enabled, setEnabled }}>
			{children}
		</AudioContext.Provider>
	)
}
