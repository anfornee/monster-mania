import type { PlayerId } from '../definitions/types'
import type { GameState } from '../engine/types'
import {
	AUDIO_MANIFEST,
	AUDIO_MUTE_FADE_MS,
	AUDIO_TRANSITION_MS,
	AUDIO_VOLUME_RAMP_MS,
	CARD_SOUND_IDS,
	DEFAULT_AUDIO_BUS_VOLUMES,
	TAVERN_MUSIC_IDS,
	clampAudioBusVolume,
	getTrackVolume,
	type AudioBus,
	type AudioBusVolumes,
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
	busVolumes?: AudioBusVolumes
	random?: () => number
	scheduler?: AudioScheduler
	now?: () => number
}

interface LongFormVoice {
	sound: AudioSound
	id: number
	slot: 0 | 1
	fadeTargetScale: number
	lifecycleFadeEndsAt: number
}

interface PrimedSceneVoice {
	scene: AudioScene
	voice: LongFormVoice
}

interface ActiveLongForm {
	layer: 'scene' | 'tavern-music'
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
	private readonly now: () => number
	private readonly sfxSounds = new Map<SfxTrackId, AudioSound>()
	private readonly longFormSounds = new Map<string, AudioSound>()
	private readonly eventCursor = new GameEventAudioCursor()
	private readonly busVolumes: AudioBusVolumes = { ...DEFAULT_AUDIO_BUS_VOLUMES }
	private enabled: boolean
	private unlocked = false
	private visible = true
	private desiredScene: AudioScene = 'menu'
	private completedScene: AudioScene | null = null
	private active: ActiveLongForm | null = null
	private activeTavernMusic: ActiveLongForm | null = null
	private outgoing: ActiveLongForm[] = []
	private transitionTimer: TimerHandle | null = null
	private primedSceneVoice: PrimedSceneVoice | null = null
	private generation = 0
	private tavernMusicIndex = 0
	private lastCardSound: CardSoundId | null = null

	constructor(backend: AudioPlaybackBackend, options: AudioManagerOptions = {}) {
		this.backend = backend
		this.enabled = options.enabled ?? true
		for (const bus of Object.keys(this.busVolumes) as AudioBus[]) {
			this.busVolumes[bus] = clampAudioBusVolume(
				options.busVolumes?.[bus] ?? DEFAULT_AUDIO_BUS_VOLUMES[bus],
			)
		}
		this.random = options.random ?? Math.random
		this.scheduler = options.scheduler ?? defaultScheduler
		this.now = options.now ?? Date.now
	}

	isEnabled(): boolean {
		return this.enabled
	}

	getBusVolume(bus: AudioBus): number {
		return this.busVolumes[bus]
	}

	setBusVolume(bus: AudioBus, volume: number): void {
		this.busVolumes[bus] = clampAudioBusVolume(volume)
		if (bus === 'sfx') {
			for (const [trackId, sound] of this.sfxSounds) {
				sound.volume(this.trackVolume(AUDIO_MANIFEST[trackId]))
			}
		}
		for (const active of [this.active, this.activeTavernMusic]) {
			if (!active || active.track.bus !== bus) continue
			for (const voice of active.voices) this.retargetVoiceForBus(active.track, voice)
		}
	}

	prepareCriticalSfx(): void {
		if (!this.enabled) return
		for (const track of Object.values(AUDIO_MANIFEST)) {
			if (track.bus === 'sfx') this.getSfxSound(track.id as SfxTrackId).load()
		}
	}

	unlock(): void {
		if (!this.unlocked) this.unlocked = true
		if (!this.visible) return
		this.backend.resume()
		this.startDesiredScene()
	}

	setEnabled(enabled: boolean): void {
		if (this.enabled === enabled) return
		this.enabled = enabled
		if (!enabled) {
			this.stopAllSfx()
			this.fadeActiveMix(AUDIO_MUTE_FADE_MS)
			return
		}
		this.prepareCriticalSfx()
		if (!this.unlocked || !this.visible) return
		if (this.active?.scene === this.desiredScene) {
			this.fadeActiveMix(AUDIO_MUTE_FADE_MS)
			return
		}
		if (!this.transitionTimer) this.startDesiredScene()
	}

	private setScene(scene: AudioScene): void {
		const changed = this.desiredScene !== scene
		this.desiredScene = scene
		if (this.primedSceneVoice?.scene !== scene) this.stopPrimedSceneVoice()
		if (changed) this.completedScene = null
		if (!this.unlocked) return
		if (!this.visible || this.active?.scene === scene || this.completedScene === scene) return
		this.beginSceneTransition()
	}

	playMenuMusic(): void {
		this.setScene('menu')
	}

	prepareMenuMusicForUserGesture(): void {
		this.setScene('menu')
		if (!this.canRunLongForm()) return
		if (this.active?.scene === 'menu') {
			if (!this.active.current.sound.playing(this.active.current.id)) {
				this.active.current.sound.play(this.active.current.id)
			}
			return
		}
		if (this.primedSceneVoice?.scene === 'menu') return
		this.stopPrimedSceneVoice()
		this.primedSceneVoice = {
			scene: 'menu',
			voice: this.playLongFormVoice(AUDIO_MANIFEST.menu, 0),
		}
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

	syncGameState(state: GameState, localPlayerId: PlayerId, resultPresented = true): void {
		this.playScene(getGameAudioScene(state, localPlayerId, resultPresented))
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
		if (!this.canPlaySfx()) return
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
		if (this.visible === visible) return
		this.visible = visible
		if (!visible) {
			this.stopAllSfx()
			this.cancelPendingTransition()
			// This also silences any detached voice finishing a mute fade.
			for (const sound of this.longFormSounds.values()) sound.pause()
			for (const active of [this.active, this.activeTavernMusic]) {
				if (!active) continue
				if (active.loopTimer) {
					this.scheduler.clearTimeout(active.loopTimer)
					active.loopTimer = null
				}
			}
			return
		}
		if (!this.unlocked) return
		this.backend.resume()
		if (this.active?.scene !== this.desiredScene) {
			this.stopActiveLongForm(0)
			this.startDesiredScene()
			return
		}
		for (const active of [this.active, this.activeTavernMusic]) {
			if (!active) continue
			for (const voice of active.voices) voice.sound.play(voice.id)
			this.fadeVoice(active.track, active.current, 1, AUDIO_MUTE_FADE_MS)
			if (active.track.loopMode === 'crossfade') this.scheduleCrossfade(active, active.current)
		}
	}

	dispose(): void {
		this.stopAllSfx()
		this.generation += 1
		this.cancelPendingTransition()
		this.stopPrimedSceneVoice()
		if (this.active?.loopTimer) this.scheduler.clearTimeout(this.active.loopTimer)
		if (this.activeTavernMusic?.loopTimer) this.scheduler.clearTimeout(this.activeTavernMusic.loopTimer)
		for (const sound of this.longFormSounds.values()) sound.stop()
		this.active = null
		this.activeTavernMusic = null
		this.completedScene = null
		this.unlocked = false
	}

	private canRunLongForm(): boolean {
		return this.unlocked && this.visible
	}

	private canPlaySfx(): boolean {
		return this.enabled && this.unlocked && this.visible
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
		if (!this.canRunLongForm() || this.transitionTimer) return
		if (this.active?.scene === this.desiredScene || this.completedScene === this.desiredScene) return
		this.startScene(this.desiredScene)
	}

	private beginSceneTransition(): void {
		if (this.transitionTimer) return
		const activeTracks = [this.active, this.activeTavernMusic].filter(
			(active): active is ActiveLongForm => active !== null,
		)
		if (activeTracks.length === 0) {
			this.startDesiredScene()
			return
		}
		this.active = null
		this.activeTavernMusic = null
		this.outgoing = activeTracks
		for (const active of activeTracks) this.fadeLongForm(active, AUDIO_TRANSITION_MS)
		this.transitionTimer = this.scheduler.setTimeout(() => {
			this.transitionTimer = null
			for (const active of this.outgoing) this.stopLongFormNow(active)
			this.outgoing = []
			this.startDesiredScene()
		}, AUDIO_TRANSITION_MS)
	}

	private startScene(scene: AudioScene): void {
		this.generation += 1
		const track = AUDIO_MANIFEST[scene] as AudioTrackDefinition
		const generation = this.generation
		const primed = this.primedSceneVoice?.scene === scene ? this.primedSceneVoice : null
		if (primed) this.primedSceneVoice = null
		else this.stopPrimedSceneVoice()
		const voice = primed?.voice ?? this.playLongFormVoice(track, 0)
		if (!voice.sound.playing(voice.id)) voice.sound.play(voice.id)
		const active: ActiveLongForm = {
			layer: 'scene',
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
		if (scene === 'ambience') this.startNextTavernMusic(generation)
	}

	private startNextTavernMusic(generation: number): void {
		if (
			this.generation !== generation
			|| this.desiredScene !== 'ambience'
			|| !this.canRunLongForm()
		) return
		const trackId = TAVERN_MUSIC_IDS[this.tavernMusicIndex]
		this.tavernMusicIndex = (this.tavernMusicIndex + 1) % TAVERN_MUSIC_IDS.length
		const track = AUDIO_MANIFEST[trackId]
		const voice = this.playLongFormVoice(track, 0)
		const active: ActiveLongForm = {
			layer: 'tavern-music',
			scene: 'ambience',
			track,
			generation,
			current: voice,
			pending: null,
			voices: new Set([voice]),
			loopTimer: null,
		}
		this.activeTavernMusic = active
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
		return {
			sound,
			id,
			slot,
			fadeTargetScale: 0,
			lifecycleFadeEndsAt: 0,
		}
	}

	private fadeInVoiceWhenPlaying(
		active: ActiveLongForm,
		voice: LongFormVoice,
		fadeMs: number,
		onStarted: () => void,
	): void {
		let handled = false
		const start = () => {
			if (handled || !this.isActive(active)) return
			handled = true
			if (fadeMs > 0) this.fadeVoice(active.track, voice, 1, fadeMs)
			else {
				voice.fadeTargetScale = 1
				voice.lifecycleFadeEndsAt = 0
				voice.sound.volume(this.trackVolume(active.track), voice.id)
			}
			onStarted()
		}
		if (voice.sound.playing(voice.id)) start()
		else voice.sound.once('play', start, voice.id)
	}

	private armLongFormVoice(active: ActiveLongForm, voice: LongFormVoice): void {
		if (active.track.loopMode === 'crossfade') {
			this.scheduleCrossfade(active, voice)
			voice.sound.once('end', () => {
				if (this.isActive(active) && active.current === voice) {
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
				if (!this.isActive(active)) return
				if (active.layer === 'tavern-music') {
					this.activeTavernMusic = null
					this.startNextTavernMusic(active.generation)
					return
				}
				this.completedScene = active.scene
				this.active = null
			}, voice.id)
		}
	}

	private scheduleCrossfade(active: ActiveLongForm, voice: LongFormVoice): void {
		const schedule = () => {
			if (!this.isActive(active) || active.current !== voice || active.loopTimer) return
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
	}

	private crossfadeLoop(active: ActiveLongForm, previous: LongFormVoice, fadeOverride?: number): void {
		if (
			!this.isActive(active)
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
			this.fadeVoice(active.track, previous, 0, fadeMs)
			this.scheduler.setTimeout(() => {
				previous.sound.stop(previous.id)
				active.voices.delete(previous)
			}, fadeMs)
			this.armLongFormVoice(active, next)
		})
	}

	private stopActiveLongForm(fadeMs: number): void {
		const activeTracks = [this.active, this.activeTavernMusic].filter(
			(active): active is ActiveLongForm => active !== null,
		)
		this.active = null
		this.activeTavernMusic = null
		for (const active of activeTracks) this.stopLongForm(active, fadeMs)
	}

	private cancelPendingTransition(): void {
		if (this.transitionTimer) this.scheduler.clearTimeout(this.transitionTimer)
		this.transitionTimer = null
		for (const active of this.outgoing) this.stopLongFormNow(active)
		this.outgoing = []
	}

	private stopPrimedSceneVoice(): void {
		if (!this.primedSceneVoice) return
		this.primedSceneVoice.voice.sound.stop(this.primedSceneVoice.voice.id)
		this.primedSceneVoice = null
	}

	private fadeLongForm(active: ActiveLongForm, fadeMs: number): void {
		if (active.loopTimer) {
			this.scheduler.clearTimeout(active.loopTimer)
			active.loopTimer = null
		}
		for (const voice of active.voices) {
			this.fadeVoice(active.track, voice, 0, fadeMs)
		}
	}

	private fadeActiveMix(durationMs: number): void {
		for (const active of [this.active, this.activeTavernMusic]) {
			if (!active) continue
			for (const voice of active.voices) {
				voice.sound.fade(
					voice.sound.getVolume(voice.id),
					this.trackVolume(active.track) * voice.fadeTargetScale,
					durationMs,
					voice.id,
				)
			}
		}
	}

	private fadeVoice(
		track: AudioTrackDefinition,
		voice: LongFormVoice,
		targetScale: number,
		durationMs: number,
	): void {
		voice.fadeTargetScale = targetScale
		voice.lifecycleFadeEndsAt = this.now() + durationMs
		voice.sound.fade(
			voice.sound.getVolume(voice.id),
			this.trackVolume(track) * targetScale,
			durationMs,
			voice.id,
		)
	}

	private retargetVoiceForBus(track: AudioTrackDefinition, voice: LongFormVoice): void {
		const targetVolume = this.trackVolume(track) * voice.fadeTargetScale
		if (!voice.sound.playing(voice.id)) {
			// HTML5 native-loop voices can briefly report false while recovering
			// from autoplay lock. Apply the current target directly so the queued
			// menu voice cannot retain its previous user volume when it resumes.
			voice.sound.volume(targetVolume, voice.id)
			return
		}
		const remainingLifecycleMs = Math.max(0, voice.lifecycleFadeEndsAt - this.now())
		voice.sound.fade(
			voice.sound.getVolume(voice.id),
			targetVolume,
			remainingLifecycleMs > 0 ? remainingLifecycleMs : AUDIO_VOLUME_RAMP_MS,
			voice.id,
		)
	}

	private stopLongFormNow(active: ActiveLongForm): void {
		if (active.loopTimer) this.scheduler.clearTimeout(active.loopTimer)
		for (const voice of active.voices) voice.sound.stop(voice.id)
		active.voices.clear()
	}

	private stopLongForm(active: ActiveLongForm, fadeMs: number): void {
		if (fadeMs <= 0) {
			this.stopLongFormNow(active)
			return
		}
		this.fadeLongForm(active, fadeMs)
		this.scheduler.setTimeout(() => this.stopLongFormNow(active), fadeMs)
	}

	private isActive(active: ActiveLongForm): boolean {
		return active.layer === 'scene'
			? this.active === active
			: this.activeTavernMusic === active
	}

	private playSfx(trackId: SfxTrackId): void {
		if (!this.canPlaySfx()) return
		this.getSfxSound(trackId).play()
	}

	private stopAllSfx(): void {
		for (const sound of this.sfxSounds.values()) sound.stop()
	}

	private getSfxSound(trackId: SfxTrackId): AudioSound {
		const existing = this.sfxSounds.get(trackId)
		if (existing) return existing
		const track = AUDIO_MANIFEST[trackId]
		const sound = this.backend.create(track, this.trackVolume(track))
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

	private trackVolume(track: AudioTrackDefinition): number {
		return this.enabled ? getTrackVolume(track, this.busVolumes) : 0
	}
}
