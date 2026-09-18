import { versionAssetPath } from '../assets/assetVersion'

export type AudioBus = 'music' | 'ambience' | 'sfx'
export type AudioPreloadTier = 'critical' | 'priority' | 'background'
export type AudioLoopMode = 'none' | 'native' | 'crossfade'

export type TavernMusicTrackId = 'tavern-music-1' | 'tavern-music-2' | 'tavern-music-3' | 'tavern-music-4'
export type LongFormTrackId = 'menu' | 'ambience' | TavernMusicTrackId | 'sudden-death' | 'victory' | 'loss'
export type CardSoundId = 'card-1' | 'card-2' | 'card-3' | 'card-4'
export type SfxTrackId = 'monster-defeated' | CardSoundId | 'shuffle'
export type AudioTrackId = LongFormTrackId | SfxTrackId
export type AudioScene = 'menu' | 'ambience' | 'sudden-death' | 'victory' | 'loss'

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

export type AudioBusVolumes = Record<AudioBus, number>

export const DEFAULT_AUDIO_BUS_VOLUMES: AudioBusVolumes = {
	music: 1,
	ambience: 1,
	sfx: 1,
}
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
		volume: .75,
		preloadTier: 'priority',
		loopMode: 'crossfade',
		approximateDurationMs: 21_000,
		crossfadeMs: 12_000,
	},
	'tavern-music-1': {
		id: 'tavern-music-1',
		src: audioPath('tavern-music-1.mp3'),
		bus: 'music',
		volume: .65,
		preloadTier: 'priority',
		loopMode: 'none',
		approximateDurationMs: 197_000,
	},
	'tavern-music-2': {
		id: 'tavern-music-2',
		src: audioPath('tavern-music-2.mp3'),
		bus: 'music',
		volume: .65,
		preloadTier: 'background',
		loopMode: 'none',
		approximateDurationMs: 336_000,
	},
	'tavern-music-3': {
		id: 'tavern-music-3',
		src: audioPath('tavern-music-3.mp3'),
		bus: 'music',
		volume: .65,
		preloadTier: 'background',
		loopMode: 'none',
		approximateDurationMs: 269_000,
	},
	'tavern-music-4': {
		id: 'tavern-music-4',
		src: audioPath('tavern-music-4.mp3'),
		bus: 'music',
		volume: .65,
		preloadTier: 'background',
		loopMode: 'none',
		approximateDurationMs: 173_000,
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
		volume: .85,
		preloadTier: 'background',
		loopMode: 'none',
		approximateDurationMs: 148_000,
	},
	loss: {
		id: 'loss',
		src: audioPath('take-the-l.mp3'),
		bus: 'music',
		volume: .85,
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
export const TAVERN_MUSIC_IDS: TavernMusicTrackId[] = [
	'tavern-music-1',
	'tavern-music-2',
	'tavern-music-3',
	'tavern-music-4',
]

export function clampAudioBusVolume(volume: number): number {
	if (!Number.isFinite(volume)) return 0
	return Math.min(1, Math.max(0, volume))
}

export function getTrackVolume(
	track: AudioTrackDefinition,
	busVolumes: AudioBusVolumes = DEFAULT_AUDIO_BUS_VOLUMES,
): number {
	return track.volume * clampAudioBusVolume(busVolumes[track.bus])
}
