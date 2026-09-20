import { useEffect, useRef, useState } from 'react'
import { useSettings } from '../game/settings/settingsContext'
import type { AudioSettings } from '../game/settings/settingsStorage'

interface SettingsDialogProps {
	open: boolean
	onClose: () => void
}

const VOLUME_CONTROLS: Array<{
	id: keyof Pick<AudioSettings, 'music' | 'ambience' | 'sfx'>
	label: string
	description: string
}> = [
	{ id: 'music', label: 'Music', description: 'Menu, match, and result music' },
	{ id: 'ambience', label: 'Ambience', description: 'Tavern and crowd atmosphere' },
	{ id: 'sfx', label: 'Sound Effects', description: 'Cards, shuffles, and Monster cues' },
]

const SLIDER_DEBOUNCE_MS = 100

function VolumeControl({
	id,
	label,
	description,
	value,
	onChange,
}: (typeof VOLUME_CONTROLS)[number] & {
	value: number
	onChange: (value: number) => void
}) {
	const [draftValue, setDraftValue] = useState(value)
	const pendingValue = useRef(value)
	const debounceTimer = useRef<number | null>(null)

	useEffect(() => () => {
		if (debounceTimer.current !== null) window.clearTimeout(debounceTimer.current)
	}, [])

	const commit = () => {
		if (debounceTimer.current !== null) window.clearTimeout(debounceTimer.current)
		debounceTimer.current = null
		onChange(pendingValue.current)
	}

	const percent = Math.round(draftValue * 100)
	return (
		<div className="volume-control">
			<div className="volume-label-row">
				<label htmlFor={`${id}-volume`}>{label}</label>
				<output htmlFor={`${id}-volume`}>{percent}%</output>
			</div>
			<span id={`${id}-description`}>{description}</span>
			<input
				id={`${id}-volume`}
				type="range"
				min="0"
				max="1"
				step="0.01"
				value={draftValue}
				aria-describedby={`${id}-description`}
				aria-valuetext={`${percent}%`}
				onChange={(event) => {
					const nextValue = event.currentTarget.valueAsNumber
					pendingValue.current = nextValue
					setDraftValue(nextValue)
					if (debounceTimer.current !== null) window.clearTimeout(debounceTimer.current)
					debounceTimer.current = window.setTimeout(commit, SLIDER_DEBOUNCE_MS)
				}}
				onPointerUp={commit}
				onBlur={commit}
			/>
		</div>
	)
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
	const { settings, setAudioSettings } = useSettings()
	const dialogRef = useRef<HTMLDialogElement>(null)
	const restoreFocusRef = useRef<HTMLElement | null>(null)
	const { audio } = settings

	useEffect(() => {
		const dialog = dialogRef.current
		if (!dialog) return
		if (open && !dialog.open) {
			restoreFocusRef.current = document.activeElement as HTMLElement | null
			dialog.showModal()
		} else if (!open && dialog.open) {
			dialog.close()
		}
	}, [open])

	const close = () => {
		if (dialogRef.current?.open) dialogRef.current.close()
		else onClose()
	}

	return (
		<dialog
			ref={dialogRef}
			className="settings-dialog"
			aria-labelledby="settings-title"
			onCancel={(event) => {
				event.preventDefault()
				close()
			}}
			onClose={() => {
				onClose()
				window.setTimeout(() => restoreFocusRef.current?.focus(), 0)
			}}
		>
			<div className="settings-heading">
				<div>
					<span className="eyebrow">Hunter's preferences</span>
					<h2 id="settings-title">Settings</h2>
				</div>
				<button type="button" className="settings-close" onClick={close} aria-label="Close settings">×</button>
			</div>
			<section className="settings-section" aria-labelledby="audio-settings-title">
				<h3 id="audio-settings-title">Audio</h3>
				<div className="master-audio-row">
					<div>
						<strong>Master Audio</strong>
						<span>Silence every audio category</span>
					</div>
					<button
						type="button"
						className="master-audio-toggle"
						aria-pressed={!audio.muted}
						onClick={() => setAudioSettings({ muted: !audio.muted })}
					>
						{audio.muted ? 'Off' : 'On'}
					</button>
				</div>
				<div className="volume-controls">
					{VOLUME_CONTROLS.map((control) => (
						<VolumeControl
							key={control.id}
							{...control}
							value={audio[control.id]}
							onChange={(value) => setAudioSettings({ [control.id]: value })}
						/>
					))}
				</div>
			</section>
			<div className="settings-actions">
				<button type="button" className="primary-button" onClick={close}>Close</button>
			</div>
		</dialog>
	)
}
