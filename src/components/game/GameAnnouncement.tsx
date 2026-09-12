import type { GameAnnouncementDetails } from '../../game/presentation/announcements'

export function GameAnnouncement({ announcement }: { announcement: GameAnnouncementDetails }) {
	return (
		<div className={`match-event-overlay ${announcement.tone}`} role="status" aria-live="polite">
			<div className="announcement-rule" aria-hidden="true" />
			<strong>{announcement.title}</strong>
			<span>{announcement.subtitle}</span>
		</div>
	)
}
