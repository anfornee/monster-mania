import type { GameEvent } from '../engine/types'

export interface GameAnnouncementDetails {
	eventId: number
	title: string
	subtitle: string
	tone: 'victory' | 'danger'
}

export function getGameAnnouncement(
	events: GameEvent[],
	afterEventId: number,
): GameAnnouncementDetails | null {
	const newEvents = events.filter((event) => event.id > afterEventId)
	const suddenDeath = newEvents.find((event) => event.type === 'sudden-death-started')
	if (suddenDeath) {
		return {
			eventId: suddenDeath.id,
			title: 'Sudden Death',
			subtitle: 'The Infinity Beast enters the arena',
			tone: 'danger',
		}
	}
	const defeated = [...newEvents].reverse().find((event) => event.type === 'monster-defeated')
	if (!defeated) return null
	const match = defeated.message.match(/ defeated (.+?) for /)
	return {
		eventId: defeated.id,
		title: 'Monster Defeated',
		subtitle: match?.[1] ?? defeated.message,
		tone: 'victory',
	}
}
