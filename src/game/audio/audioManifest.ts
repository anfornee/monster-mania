import { versionAssetPath } from '../assets/assetVersion'

export type AudioBus = 'music' | 'ambience' | 'sfx'
export type AudioPreloadTier = 'critical' | 'priority' | 'background'
export type AudioLoopMode = 'none' | 'native' | 'crossfade'

export type LongFormTrackId = 'menu' | 'ambience' | 'sudden-death' | 'victory' | 'loss'
export type CardSoundId = 'card-1' | 'card-2' | 'card-3' | 'card-4'
export type SfxTrackId = 'monster-defeated' | CardSoundId | 'shuffle'
export type AudioTrackId = LongFormTrackId | SfxTrackId
export type AudioScene = LongFormTrackId

export interface AudioTrackDefinition {
	id: AudioTrackId
	src: string
	bus: AudioBus
	volume: number
	preloadTier: AudioPreloadTier
	loopMode: AudioLoopMode
	approximateDurationMs: number
	crossfadeMs?: number
}

const audioPath = (filename: string) => versionAssetPath(`/assets/audio/${filename}`)

export const AUDIO_BUS_VOLUMES: Record<AudioBus, number> = {
	music: .5,
	ambience: .36,
	sfx: .74,
}

export const AUDIO_MASTER_VOLUME = .9
export const AUDIO_TRANSITION_MS = 1_200
export const AUDIO_MUTE_FADE_MS = 320

export const AUDIO_MANIFEST = {
	menu: {
		id: 'menu',
		src: audioPath('welcome-hunter.mp3'),
		bus: 'music',
		volume: .9,
		preloadTier: 'priority',
		loopMode: 'native',
		approximateDurationMs: 152_000,
	},
	ambience: {
		id: 'ambience',
		src: audioPath('tavern-ambience.mp3'),
		bus: 'ambience',
		volume: .9,
		preloadTier: 'priority',
		loopMode: 'crossfade',
		approximateDurationMs: 21_000,
		crossfadeMs: 12_000,
	},
	'sudden-death': {
		id: 'sudden-death',
		src: audioPath('battle-for-eternity.mp3'),
		bus: 'music',
		volume: .84,
		preloadTier: 'background',
		loopMode: 'crossfade',
		approximateDurationMs: 132_000,
		crossfadeMs: 5_000,
	},
	victory: {
		id: 'victory',
		src: audioPath('dubs-in-the-chat.mp3'),
		bus: 'music',
		volume: 1,
		preloadTier: 'background',
		loopMode: 'none',
		approximateDurationMs: 148_000,
	},
	loss: {
		id: 'loss',
		src: audioPath('take-the-l.mp3'),
		bus: 'music',
		volume: .92,
		preloadTier: 'background',
		loopMode: 'none',
		approximateDurationMs: 158_000,
	},
	'monster-defeated': {
		id: 'monster-defeated',
		src: audioPath('monster-defeated.mp3'),
		bus: 'sfx',
		volume: .85,
		preloadTier: 'critical',
		loopMode: 'none',
		approximateDurationMs: 2_000,
	},
	'card-1': {
		id: 'card-1',
		src: audioPath('card-1.mp3'),
		bus: 'sfx',
		volume: .72,
		preloadTier: 'critical',
		loopMode: 'none',
		approximateDurationMs: 1_000,
	},
	'card-2': {
		id: 'card-2',
		src: audioPath('card-2.mp3'),
		bus: 'sfx',
		volume: .72,
		preloadTier: 'critical',
		loopMode: 'none',
		approximateDurationMs: 1_000,
	},
	'card-3': {
		id: 'card-3',
		src: audioPath('card-3.mp3'),
		bus: 'sfx',
		volume: .72,
		preloadTier: 'critical',
		loopMode: 'none',
		approximateDurationMs: 1_000,
	},
	'card-4': {
		id: 'card-4',
		src: audioPath('card-4.mp3'),
		bus: 'sfx',
		volume: .72,
		preloadTier: 'critical',
		loopMode: 'none',
		approximateDurationMs: 1_000,
	},
	shuffle: {
		id: 'shuffle',
		src: audioPath('shuffle-cards.mp3'),
		bus: 'sfx',
		volume: .76,
		preloadTier: 'critical',
		loopMode: 'none',
		approximateDurationMs: 1_000,
	},
} as const satisfies Record<AudioTrackId, AudioTrackDefinition>

export const AUDIO_TRACKS = Object.values(AUDIO_MANIFEST)
export const CARD_SOUND_IDS: CardSoundId[] = ['card-1', 'card-2', 'card-3', 'card-4']

export function getTrackVolume(track: AudioTrackDefinition): number {
	return AUDIO_MASTER_VOLUME * AUDIO_BUS_VOLUMES[track.bus] * track.volume
}
