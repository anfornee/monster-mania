import type { PlayerId } from '../definitions/types'
import type { GameState } from '../engine/types'
import {
	AUDIO_MANIFEST,
	AUDIO_MUTE_FADE_MS,
	AUDIO_TRANSITION_MS,
	CARD_SOUND_IDS,
	getTrackVolume,
	type AudioScene,
	type AudioTrackDefinition,
	type CardSoundId,
	type LongFormTrackId,
	type SfxTrackId,
} from './audioManifest'
import type { AudioPlaybackBackend, AudioSound } from './audioPlayback'
import { GameEventAudioCursor, getGameAudioCues, getGameAudioScene } from './gameAudio'

type TimerHandle = ReturnType<typeof globalThis.setTimeout>

export interface AudioScheduler {
	setTimeout: (callback: () => void, delayMs: number) => TimerHandle
	clearTimeout: (handle: TimerHandle) => void
}

interface AudioManagerOptions {
	enabled?: boolean
	random?: () => number
	scheduler?: AudioScheduler
}

interface LongFormVoice {
	sound: AudioSound
	id: number
	slot: 0 | 1
}

interface ActiveLongForm {
	scene: AudioScene
	track: AudioTrackDefinition
	generation: number
	current: LongFormVoice
	pending: LongFormVoice | null
	voices: Set<LongFormVoice>
	loopTimer: TimerHandle | null
}

const defaultScheduler: AudioScheduler = {
	setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
	clearTimeout: (handle) => globalThis.clearTimeout(handle),
}

export class AudioManager {
	private readonly backend: AudioPlaybackBackend
	private readonly random: () => number
	private readonly scheduler: AudioScheduler
	private readonly sfxSounds = new Map<SfxTrackId, AudioSound>()
	private readonly longFormSounds = new Map<string, AudioSound>()
	private readonly eventCursor = new GameEventAudioCursor()
	private enabled: boolean
	private unlocked = false
	private desiredScene: AudioScene = 'menu'
	private completedScene: AudioScene | null = null
	private active: ActiveLongForm | null = null
	private generation = 0
	private lastCardSound: CardSoundId | null = null

	constructor(backend: AudioPlaybackBackend, options: AudioManagerOptions = {}) {
		this.backend = backend
		this.enabled = options.enabled ?? true
		this.random = options.random ?? Math.random
		this.scheduler = options.scheduler ?? defaultScheduler
	}

	isEnabled(): boolean {
		return this.enabled
	}

	prepareCriticalSfx(): void {
		if (!this.enabled) return
		for (const track of Object.values(AUDIO_MANIFEST)) {
			if (track.bus === 'sfx') this.getSfxSound(track.id as SfxTrackId).load()
		}
	}

	unlock(): void {
		if (!this.enabled) return
		this.backend.resume()
		if (this.unlocked) return
		this.unlocked = true
		this.startDesiredScene()
	}

	setEnabled(enabled: boolean): void {
		if (this.enabled === enabled) return
		this.enabled = enabled
		if (!enabled) {
			this.stopAllSfx()
			this.stopActiveLongForm(AUDIO_MUTE_FADE_MS)
			return
		}
		this.prepareCriticalSfx()
		if (this.unlocked) this.startDesiredScene()
	}

	private setScene(scene: AudioScene): void {
		const changed = this.desiredScene !== scene
		this.desiredScene = scene
		if (changed) this.completedScene = null
		if (!this.enabled || !this.unlocked) return
		if (this.active?.scene === scene || this.completedScene === scene) return
		this.transitionTo(scene)
	}

	playMenuMusic(): void {
		this.setScene('menu')
	}

	startGameAmbience(): void {
		this.setScene('ambience')
	}

	startSuddenDeathMusic(): void {
		this.setScene('sudden-death')
	}

	playVictoryMusic(): void {
		this.setScene('victory')
	}

	playLossMusic(): void {
		this.setScene('loss')
	}

	syncGameState(state: GameState, localPlayerId: PlayerId): void {
		this.playScene(getGameAudioScene(state, localPlayerId))
		const events = this.eventCursor.takeNewEvents(state.events)
		for (const cue of getGameAudioCues(events, state)) {
			switch (cue) {
				case 'card':
					this.playCardSound()
					break
				case 'monster-defeated':
					this.playMonsterDefeated()
					break
				case 'shuffle':
					this.playShuffleSound()
					break
			}
		}
	}

	playCardSound(): void {
		if (!this.canPlay()) return
		const choices = CARD_SOUND_IDS.filter((id) => id !== this.lastCardSound)
		const index = Math.min(choices.length - 1, Math.floor(this.random() * choices.length))
		const selected = choices[Math.max(0, index)]
		this.lastCardSound = selected
		this.playSfx(selected)
	}

	playShuffleSound(): void {
		this.playSfx('shuffle')
	}

	playMonsterDefeated(): void {
		this.playSfx('monster-defeated')
	}

	handleVisibilityChange(visible: boolean): void {
		if (visible && this.enabled && this.unlocked) this.backend.resume()
	}

	dispose(): void {
		this.stopAllSfx()
		this.generation += 1
		if (this.active?.loopTimer) this.scheduler.clearTimeout(this.active.loopTimer)
		for (const sound of this.longFormSounds.values()) sound.stop()
		this.active = null
	}

	private canPlay(): boolean {
		return this.enabled && this.unlocked
	}

	private playScene(scene: AudioScene): void {
		switch (scene) {
			case 'menu':
				this.playMenuMusic()
				break
			case 'ambience':
				this.startGameAmbience()
				break
			case 'sudden-death':
				this.startSuddenDeathMusic()
				break
			case 'victory':
				this.playVictoryMusic()
				break
			case 'loss':
				this.playLossMusic()
		}
	}

	private startDesiredScene(): void {
		if (this.active?.scene === this.desiredScene || this.completedScene === this.desiredScene) return
		this.transitionTo(this.desiredScene)
	}

	private transitionTo(scene: AudioScene): void {
		this.stopActiveLongForm(AUDIO_TRANSITION_MS)
		this.generation += 1
		const track = AUDIO_MANIFEST[scene] as AudioTrackDefinition
		const generation = this.generation
		const voice = this.playLongFormVoice(track, 0)
		const active: ActiveLongForm = {
			scene,
			track,
			generation,
			current: voice,
			pending: null,
			voices: new Set([voice]),
			loopTimer: null,
		}
		this.active = active
		if (track.loopMode === 'crossfade') {
			this.getLongFormSound(track.id as LongFormTrackId, 1).load()
		}
		this.fadeInVoiceWhenPlaying(active, voice, AUDIO_TRANSITION_MS, () => {
			this.armLongFormVoice(active, voice)
		})
	}

	private playLongFormVoice(
		track: AudioTrackDefinition,
		slot: 0 | 1,
	): LongFormVoice {
		const sound = this.getLongFormSound(track.id as LongFormTrackId, slot)
		sound.volume(0)
		const id = sound.play()
		sound.volume(0, id)
		return { sound, id, slot }
	}

	private fadeInVoiceWhenPlaying(
		active: ActiveLongForm,
		voice: LongFormVoice,
		fadeMs: number,
		onStarted: () => void,
	): void {
		let handled = false
		const start = () => {
			if (handled || this.active?.generation !== active.generation) return
			handled = true
			const targetVolume = getTrackVolume(active.track)
			if (fadeMs > 0) voice.sound.fade(0, targetVolume, fadeMs, voice.id)
			else voice.sound.volume(targetVolume, voice.id)
			onStarted()
		}
		if (voice.sound.playing(voice.id)) start()
		else voice.sound.once('play', start, voice.id)
	}

	private armLongFormVoice(active: ActiveLongForm, voice: LongFormVoice): void {
		if (active.track.loopMode === 'crossfade') {
			const schedule = () => {
				if (this.active?.generation !== active.generation || active.current !== voice) return
				const measuredDuration = voice.sound.duration(voice.id) * 1_000
				const duration = Number.isFinite(measuredDuration) && measuredDuration > 0
					? Math.min(measuredDuration, active.track.approximateDurationMs)
					: active.track.approximateDurationMs
				const delay = Math.max(250, duration - (active.track.crossfadeMs ?? 0))
				active.loopTimer = this.scheduler.setTimeout(
					() => this.crossfadeLoop(active, voice),
					delay,
				)
			}
			if (voice.sound.playing(voice.id)) schedule()
			else voice.sound.once('play', schedule, voice.id)
			voice.sound.once('end', () => {
				if (this.active?.generation === active.generation && active.current === voice) {
					if (active.pending) {
						active.pending.sound.stop(active.pending.id)
						active.voices.delete(active.pending)
						active.pending = null
					}
					this.crossfadeLoop(active, voice, 0)
				}
			}, voice.id)
			return
		}

		if (active.track.loopMode === 'none') {
			voice.sound.once('end', () => {
				if (this.active?.generation !== active.generation) return
				this.completedScene = active.scene
				this.active = null
			}, voice.id)
		}
	}

	private crossfadeLoop(active: ActiveLongForm, previous: LongFormVoice, fadeOverride?: number): void {
		if (
			this.active?.generation !== active.generation
			|| active.current !== previous
			|| active.pending
		) return
		active.loopTimer = null
		const fadeMs = fadeOverride ?? active.track.crossfadeMs ?? 0
		const nextSlot: 0 | 1 = previous.slot === 0 ? 1 : 0
		const next = this.playLongFormVoice(active.track, nextSlot)
		active.pending = next
		active.voices.add(next)
		this.fadeInVoiceWhenPlaying(active, next, fadeMs, () => {
			if (active.current !== previous || active.pending !== next) return
			active.pending = null
			active.current = next
			previous.sound.fade(previous.sound.getVolume(previous.id), 0, fadeMs, previous.id)
			this.scheduler.setTimeout(() => {
				previous.sound.stop(previous.id)
				active.voices.delete(previous)
			}, fadeMs)
			this.armLongFormVoice(active, next)
		})
	}

	private stopActiveLongForm(fadeMs: number): void {
		const active = this.active
		if (!active) return
		if (active.loopTimer) this.scheduler.clearTimeout(active.loopTimer)
		this.active = null
		for (const voice of active.voices) {
			voice.sound.fade(voice.sound.getVolume(voice.id), 0, fadeMs, voice.id)
			this.scheduler.setTimeout(() => voice.sound.stop(voice.id), fadeMs)
		}
	}

	private playSfx(trackId: SfxTrackId): void {
		if (!this.canPlay()) return
		this.getSfxSound(trackId).play()
	}

	private stopAllSfx(): void {
		for (const sound of this.sfxSounds.values()) sound.stop()
	}

	private getSfxSound(trackId: SfxTrackId): AudioSound {
		const existing = this.sfxSounds.get(trackId)
		if (existing) return existing
		const track = AUDIO_MANIFEST[trackId]
		const sound = this.backend.create(track, getTrackVolume(track))
		this.sfxSounds.set(trackId, sound)
		return sound
	}

	private getLongFormSound(trackId: LongFormTrackId, slot: 0 | 1): AudioSound {
		const key = `${trackId}:${slot}`
		const existing = this.longFormSounds.get(key)
		if (existing) return existing
		const track = AUDIO_MANIFEST[trackId]
		const sound = this.backend.create(track, 0)
		this.longFormSounds.set(key, sound)
		return sound
	}
}
