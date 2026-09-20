import {
	useEffect,
	useLayoutEffect,
	useState,
	type ReactNode,
} from 'react'
import { useSettings } from '../settings/settingsContext'
import { getAudioBusSettings } from '../settings/settingsStorage'
import { AudioManager } from './AudioManager'
import { AudioContext } from './audioContext'
import { HowlerPlaybackBackend } from './audioPlayback'

export function AudioProvider({ children }: { children: ReactNode }) {
	const { settings } = useSettings()
	const { audio } = settings
	const enabled = !audio.muted
	const [manager] = useState(() => new AudioManager(
		new HowlerPlaybackBackend(),
		{ enabled, busVolumes: getAudioBusSettings(settings) },
	))

	useLayoutEffect(() => {
		manager.setBusVolume('music', audio.music)
	}, [audio.music, manager])

	useLayoutEffect(() => {
		manager.setBusVolume('ambience', audio.ambience)
	}, [audio.ambience, manager])

	useLayoutEffect(() => {
		manager.setBusVolume('sfx', audio.sfx)
	}, [audio.sfx, manager])

	useEffect(() => {
		manager.setEnabled(enabled)
		if (enabled) manager.prepareCriticalSfx()
		manager.handleVisibilityChange(!document.hidden)
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

	return (
		<AudioContext.Provider value={{ manager }}>
			{children}
		</AudioContext.Provider>
	)
}
