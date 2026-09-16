import type { PlayerId } from '../definitions/types'
import type { GameEvent, GameState } from '../engine/types'
import type { AudioScene } from './audioManifest'

export type GameAudioCue = 'card' | 'monster-defeated' | 'shuffle'

export function getGameAudioScene(state: GameState, localPlayerId: PlayerId): AudioScene {
	if (state.phase === 'game-over') {
		return state.winnerId === localPlayerId ? 'victory' : 'loss'
	}
	return state.mode === 'sudden-death' ? 'sudden-death' : 'ambience'
}

export function getGameAudioCues(events: GameEvent[], state: GameState): GameAudioCue[] {
	const cues: GameAudioCue[] = []
	const shuffle = events.some((event) => (
		event.type === 'game-started'
		|| event.type === 'draw-deck-recycled'
		|| event.type === 'monsters-rotated'
	))
	if (shuffle) cues.push('shuffle')

	for (const event of events) {
		if (
			event.type === 'action-played'
			|| event.type === 'cards-drawn'
			|| event.type === 'card-discarded'
			|| event.type === 'ultimate-used'
		) cues.push('card')
	}

	const defeatedMonster = events.some((event) => event.type === 'monster-defeated')
	const defeatedInfinityBeast = state.mode === 'sudden-death'
		&& state.phase === 'game-over'
		&& events.some((event) => event.type === 'game-won')
	if (defeatedMonster || defeatedInfinityBeast) cues.push('monster-defeated')
	return cues
}

export class GameEventAudioCursor {
	private lastEventId: number | null = null

	takeNewEvents(events: GameEvent[]): GameEvent[] {
		const latest = events.at(-1)
		if (!latest) return []

		if (this.lastEventId === null) {
			this.lastEventId = latest.id
			return events.length === 1 && events[0].type === 'game-started' ? events : []
		}

		if (latest.id < this.lastEventId) {
			this.lastEventId = latest.id
			return events.length === 1 && events[0].type === 'game-started' ? events : []
		}
		if (latest.id === this.lastEventId) return []

		const fresh = events.filter((event) => event.id > this.lastEventId!)
		this.lastEventId = latest.id
		return fresh
	}
}
