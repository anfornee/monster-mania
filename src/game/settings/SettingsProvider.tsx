import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { SettingsContext } from './settingsContext'
import {
	loadAppSettings,
	saveAppSettings,
	updateAudioSettings,
	type AudioSettings,
} from './settingsStorage'

export function SettingsProvider({ children }: { children: ReactNode }) {
	const [settings, setSettings] = useState(() => loadAppSettings(window.localStorage))
	const latestSettings = useRef(settings)

	useEffect(() => {
		latestSettings.current = settings
		const saveTimer = window.setTimeout(() => {
			saveAppSettings(window.localStorage, settings)
		}, 250)
		return () => window.clearTimeout(saveTimer)
	}, [settings])

	useEffect(() => {
		const saveBeforeLeaving = () => saveAppSettings(window.localStorage, latestSettings.current)
		window.addEventListener('pagehide', saveBeforeLeaving)
		return () => window.removeEventListener('pagehide', saveBeforeLeaving)
	}, [])

	const setAudioSettings = useCallback((update: Partial<AudioSettings>) => {
		setSettings((current) => updateAudioSettings(current, update))
	}, [])

	return (
		<SettingsContext.Provider value={{ settings, setAudioSettings }}>
			{children}
		</SettingsContext.Provider>
	)
}
