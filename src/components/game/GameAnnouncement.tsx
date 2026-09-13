import type { CSSProperties } from 'react'
import type { GameAnnouncementDetails } from '../../game/presentation/announcements'
import { GAME_TIMING } from '../../game/presentation/aiPacing'

export function GameAnnouncement({ announcement, onComplete }: {
	announcement: GameAnnouncementDetails
	onComplete?: () => void
}) {
	return (
		<div
			className={`match-event-overlay ${announcement.tone}`}
			role="status"
			aria-live="polite"
			style={{ '--announcement-duration': `${GAME_TIMING.announcement}ms` } as CSSProperties}
			onAnimationEnd={(event) => {
				if (event.target === event.currentTarget) onComplete?.()
			}}
		>
			<div className="announcement-rule" aria-hidden="true" />
			<strong>{announcement.title}</strong>
			<span>{announcement.subtitle}</span>
		</div>
	)
}
