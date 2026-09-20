import { createContext, useContext } from 'react'
import type { AudioSettings, AppSettings } from './settingsStorage'

export interface SettingsContextValue {
	settings: AppSettings
	setAudioSettings: (update: Partial<AudioSettings>) => void
}

export const SettingsContext = createContext<SettingsContextValue | null>(null)

export function useSettings(): SettingsContextValue {
	const context = useContext(SettingsContext)
	if (!context) throw new Error('useSettings must be used inside SettingsProvider.')
	return context
}
