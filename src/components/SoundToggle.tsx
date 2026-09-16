import { useAudio } from '../game/audio/audioContext'

export function SoundToggle() {
	const { enabled, setEnabled } = useAudio()
	const actionLabel = enabled ? 'Mute sound' : 'Enable sound'
	return (
		<button
			type="button"
			className="sound-toggle"
			aria-label="Sound"
			aria-pressed={enabled}
			title={actionLabel}
			onClick={() => setEnabled(!enabled)}
		>
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path d="M4 9v6h4l5 4V5L8 9H4Z" />
				{enabled
					? <path d="M16 8.2a5 5 0 0 1 0 7.6M18.5 5.7a8.5 8.5 0 0 1 0 12.6" />
					: <path d="m16 9 5 5m0-5-5 5" />}
			</svg>
			<span className="sr-only">Sound is {enabled ? 'on' : 'off'}</span>
		</button>
	)
}
