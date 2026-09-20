import { useState } from 'react'
import { createPortal } from 'react-dom'
import { SettingsDialog } from './SettingsDialog'

export function SettingsControl() {
	const [open, setOpen] = useState(false)

	return (
		<>
			<button
				type="button"
				className="settings-gear-button"
				aria-label="Open settings"
				title="Settings"
				onClick={() => setOpen(true)}
			>
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.09a2 2 0 0 1 1 1.74v.5a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
					<circle cx="12" cy="12" r="3" />
				</svg>
				<span className="sr-only">Settings</span>
			</button>
			{createPortal(
				<SettingsDialog open={open} onClose={() => setOpen(false)} />,
				document.body,
			)}
		</>
	)
}
