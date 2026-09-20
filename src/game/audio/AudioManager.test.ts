import { describe, expect, it } from 'vitest'
import { createSandboxScenario } from '../sandbox/presets'
import { AudioManager, type AudioScheduler } from './AudioManager'
import {
	AUDIO_MANIFEST,
	AUDIO_MUTE_FADE_MS,
	AUDIO_TRANSITION_MS,
	AUDIO_VOLUME_RAMP_MS,
	TAVERN_MUSIC_IDS,
	getTrackVolume,
	type AudioTrackDefinition,
} from './audioManifest'
import type { AudioPlaybackBackend, AudioPlaybackEvent, AudioSound } from './audioPlayback'
import { getGameAudioScene } from './gameAudio'

class FakeSound implements AudioSound {
	playCount = 0
	loadCount = 0
	stopCount = 0
	pauseCount = 0
	readonly fadeCalls: Array<{ from: number; to: number; durationMs: number; id: number }> = []
	reportPlaying = true
	private nextId = 1
	private readonly active = new Set<number>()
	private readonly endListeners = new Map<number, Array<(id: number) => void>>()
	private currentVolume: number

	constructor(initialVolume = 1) {
		this.currentVolume = initialVolume
	}

	play(existingId?: number): number {
		if (existingId !== undefined) {
			this.active.add(existingId)
			return existingId
		}
		const id = this.nextId
		this.nextId += 1
		this.playCount += 1
		this.active.add(id)
		return id
	}

	pause(id?: number): void {
		this.pauseCount += 1
		if (id === undefined) this.active.clear()
		else this.active.delete(id)
	}

	stop(id?: number): void {
		this.stopCount += 1
		if (id === undefined) this.active.clear()
		else this.active.delete(id)
	}

	fade(from: number, to: number, durationMs: number, id: number): void {
		this.fadeCalls.push({ from, to, durationMs, id })
		this.currentVolume = to
	}
	volume(volume: number): void { this.currentVolume = volume }
	getVolume(): number { return this.currentVolume }
	playing(id?: number): boolean {
		if (!this.reportPlaying) return false
		return id === undefined ? this.active.size > 0 : this.active.has(id)
	}
	duration(): number { return 100 }
	once(event: AudioPlaybackEvent, callback: (id: number) => void, id?: number): void {
		if (event !== 'end' || id === undefined) return
		const listeners = this.endListeners.get(id) ?? []
		listeners.push(callback)
		this.endListeners.set(id, listeners)
	}
	load(): void { this.loadCount += 1 }

	finishFirst(): void {
		const id = this.active.values().next().value as number | undefined
		if (id === undefined) throw new Error('No active sound to finish.')
		this.active.delete(id)
		const listeners = this.endListeners.get(id) ?? []
		this.endListeners.delete(id)
		for (const listener of listeners) listener(id)
	}
}

class FakeBackend implements AudioPlaybackBackend {
	readonly sounds = new Map<string, FakeSound[]>()
	resumeCount = 0

	create(track: AudioTrackDefinition, initialVolume: number): AudioSound {
		const sound = new FakeSound(initialVolume)
		const sounds = this.sounds.get(track.id) ?? []
		sounds.push(sound)
		this.sounds.set(track.id, sounds)
		return sound
	}

	resume(): void { this.resumeCount += 1 }

	playCount(trackId: string): number {
		return (this.sounds.get(trackId) ?? []).reduce((total, sound) => total + sound.playCount, 0)
	}
}

function inertScheduler(): AudioScheduler {
	let nextHandle = 1
	return {
		setTimeout: () => {
			const handle = nextHandle
			nextHandle += 1
			return handle as unknown as ReturnType<typeof globalThis.setTimeout>
		},
		clearTimeout: () => undefined,
	}
}

class RecordingScheduler implements AudioScheduler {
	private nextHandle = 1
	readonly tasks: Array<{
		handle: ReturnType<typeof globalThis.setTimeout>
		callback: () => void
		delayMs: number
	}> = []

	setTimeout(callback: () => void, delayMs: number): ReturnType<typeof globalThis.setTimeout> {
		const handle = this.nextHandle as unknown as ReturnType<typeof globalThis.setTimeout>
		this.nextHandle += 1
		this.tasks.push({ handle, callback, delayMs })
		return handle
	}

	clearTimeout(handle: ReturnType<typeof globalThis.setTimeout>): void {
		const index = this.tasks.findIndex((task) => task.handle === handle)
		if (index >= 0) this.tasks.splice(index, 1)
	}

	runFirst(delayMs: number): void {
		const index = this.tasks.findIndex((task) => task.delayMs === delayMs)
		if (index < 0) throw new Error(`No scheduled audio task found at ${delayMs}ms.`)
		const [task] = this.tasks.splice(index, 1)
		task.callback()
	}

	runAll(delayMs: number): void {
		const tasks = this.tasks.filter((task) => task.delayMs === delayMs)
		this.tasks.splice(0, this.tasks.length, ...this.tasks.filter((task) => task.delayMs !== delayMs))
		for (const task of tasks) task.callback()
	}
}

function managerWith(backend: FakeBackend, enabled = true, random = () => 0): AudioManager {
	return new AudioManager(backend, { enabled, random, scheduler: inertScheduler() })
}

describe('AudioManager', () => {
	it('keeps long-form audio running silently while suppressing muted SFX', () => {
		const backend = new FakeBackend()
		const manager = managerWith(backend, false)
		manager.startGameAmbience()
		manager.unlock()
		manager.playCardSound()
		manager.playShuffleSound()
		expect(backend.playCount('ambience')).toBe(1)
		expect(backend.sounds.get('ambience')?.[0].getVolume()).toBe(0)
		expect(backend.playCount('shuffle')).toBe(0)
	})

	it('mutes and restores an active track without stopping or restarting it', () => {
		const backend = new FakeBackend()
		const manager = managerWith(backend)
		manager.unlock()
		const menu = backend.sounds.get('menu')?.[0]
		expect(menu?.playCount).toBe(1)
		manager.setEnabled(false)
		expect(menu?.playing()).toBe(true)
		expect(menu?.stopCount).toBe(0)
		expect(menu?.getVolume()).toBe(0)
		manager.setEnabled(true)
		expect(menu?.playCount).toBe(1)
		expect(menu?.getVolume()).toBe(AUDIO_MANIFEST.menu.volume)
	})

	it('advances scene changes silently while muted and unmutes the current scene', () => {
		const backend = new FakeBackend()
		const scheduler = new RecordingScheduler()
		const manager = new AudioManager(backend, { enabled: false, scheduler })
		manager.unlock()
		manager.startGameAmbience()
		scheduler.runFirst(AUDIO_TRANSITION_MS)
		const ambience = backend.sounds.get('ambience')?.[0]
		const music = backend.sounds.get('tavern-music-1')?.[0]
		expect(ambience?.getVolume()).toBe(0)
		expect(music?.getVolume()).toBe(0)
		manager.setEnabled(true)
		expect(backend.playCount('ambience')).toBe(1)
		expect(backend.playCount('tavern-music-1')).toBe(1)
		expect(ambience?.getVolume()).toBe(AUDIO_MANIFEST.ambience.volume)
		expect(music?.getVolume()).toBe(AUDIO_MANIFEST['tavern-music-1'].volume)
	})

	it('restores the desired long-form scene after enabling and unlocking', () => {
		const backend = new FakeBackend()
		const manager = managerWith(backend, false)
		manager.startGameAmbience()
		manager.setEnabled(true)
		manager.unlock()
		expect(backend.playCount('ambience')).toBe(1)
	})

	it('transitions through menu, gameplay, sudden death, results, and back to menu', () => {
		const backend = new FakeBackend()
		const scheduler = new RecordingScheduler()
		const manager = new AudioManager(backend, { scheduler, random: () => 0 })
		manager.unlock()
		manager.startGameAmbience()
		expect(backend.playCount('ambience')).toBe(0)
		scheduler.runFirst(AUDIO_TRANSITION_MS)
		manager.startSuddenDeathMusic()
		scheduler.runFirst(AUDIO_TRANSITION_MS)
		manager.playVictoryMusic()
		scheduler.runFirst(AUDIO_TRANSITION_MS)
		manager.playLossMusic()
		scheduler.runFirst(AUDIO_TRANSITION_MS)
		manager.playMenuMusic()
		scheduler.runFirst(AUDIO_TRANSITION_MS)
		expect(backend.playCount('menu')).toBe(2)
		expect(backend.playCount('ambience')).toBe(1)
		expect(backend.playCount('tavern-music-1')).toBe(1)
		expect(backend.playCount('sudden-death')).toBe(1)
		expect(backend.playCount('victory')).toBe(1)
		expect(backend.playCount('loss')).toBe(1)
	})

	it('finishes the outgoing fade before starting only the latest requested scene', () => {
		const backend = new FakeBackend()
		const scheduler = new RecordingScheduler()
		const manager = new AudioManager(backend, { scheduler })
		manager.unlock()
		manager.startGameAmbience()
		manager.playVictoryMusic()

		expect(backend.playCount('ambience')).toBe(0)
		expect(backend.playCount('victory')).toBe(0)
		expect(backend.sounds.get('menu')?.[0].playing()).toBe(true)

		scheduler.runFirst(AUDIO_TRANSITION_MS)

		expect(backend.sounds.get('menu')?.[0].playing()).toBe(false)
		expect(backend.playCount('ambience')).toBe(0)
		expect(backend.playCount('victory')).toBe(1)
	})

	it('primes menu playback during the return gesture without audible overlap', () => {
		const backend = new FakeBackend()
		const scheduler = new RecordingScheduler()
		const manager = new AudioManager(backend, { scheduler })
		manager.unlock()
		manager.startGameAmbience()
		scheduler.runFirst(AUDIO_TRANSITION_MS)

		manager.prepareMenuMusicForUserGesture()

		expect(backend.playCount('menu')).toBe(2)
		expect(backend.sounds.get('ambience')?.[0].playing()).toBe(true)
		scheduler.runFirst(AUDIO_TRANSITION_MS)
		expect(backend.playCount('menu')).toBe(2)
		expect(backend.sounds.get('ambience')?.[0].playing()).toBe(false)
		expect(backend.sounds.get('menu')?.[0].playing()).toBe(true)
	})

	it('plays all tavern music as a playlist and stops it for priority music', () => {
		const backend = new FakeBackend()
		const scheduler = new RecordingScheduler()
		const manager = new AudioManager(backend, { scheduler })
		manager.unlock()
		manager.startGameAmbience()
		scheduler.runFirst(AUDIO_TRANSITION_MS)

		for (let index = 0; index < TAVERN_MUSIC_IDS.length; index += 1) {
			const trackId = TAVERN_MUSIC_IDS[index]
			expect(backend.playCount(trackId)).toBe(1)
			if (index < TAVERN_MUSIC_IDS.length - 1) {
				backend.sounds.get(trackId)?.[0].finishFirst()
			}
		}

		manager.startSuddenDeathMusic()
		scheduler.runAll(AUDIO_TRANSITION_MS)
		expect(backend.playCount('sudden-death')).toBe(1)
		expect(backend.sounds.get('tavern-music-4')?.[0].playing()).toBe(false)

		manager.startGameAmbience()
		scheduler.runFirst(AUDIO_TRANSITION_MS)
		expect(backend.playCount('tavern-music-1')).toBe(2)
		manager.playVictoryMusic()
		scheduler.runAll(AUDIO_TRANSITION_MS)
		expect(backend.playCount('victory')).toBe(1)
		expect(backend.sounds.get('tavern-music-1')?.[0].playing()).toBe(false)
	})

	it('primes and alternates two ambience players before the measured track ends', () => {
		const backend = new FakeBackend()
		const scheduler = new RecordingScheduler()
		const manager = new AudioManager(backend, { scheduler })
		manager.unlock()
		manager.startGameAmbience()
		scheduler.runFirst(AUDIO_TRANSITION_MS)

		const ambienceSounds = backend.sounds.get('ambience') ?? []
		expect(ambienceSounds).toHaveLength(2)
		expect(ambienceSounds[1].loadCount).toBe(1)
		scheduler.runFirst(
			AUDIO_MANIFEST.ambience.approximateDurationMs - AUDIO_MANIFEST.ambience.crossfadeMs,
		)
		expect(backend.playCount('ambience')).toBe(2)
		expect(ambienceSounds.every((sound) => sound.playing())).toBe(true)
	})

	it('keeps the requested fade and mix adjustments in configuration', () => {
		expect(AUDIO_TRANSITION_MS).toBe(1_200)
		expect(AUDIO_MUTE_FADE_MS).toBe(320)
		expect(AUDIO_MANIFEST.menu.approximateDurationMs).toBe(152_000)
		expect(AUDIO_MANIFEST.menu.loopMode).toBe('native')
		expect(AUDIO_MANIFEST.ambience.volume).toBe(.75)
		expect(AUDIO_MANIFEST.ambience.approximateDurationMs).toBe(21_000)
		expect(AUDIO_MANIFEST.ambience.crossfadeMs).toBe(12_000)
		for (const trackId of TAVERN_MUSIC_IDS) {
			expect(AUDIO_MANIFEST[trackId].volume).toBe(.65)
		}
		expect(AUDIO_MANIFEST['sudden-death'].volume).toBe(.84)
		expect(AUDIO_MANIFEST['sudden-death'].crossfadeMs).toBe(5_000)
		expect(AUDIO_MANIFEST.victory.volume).toBe(.85)
		expect(AUDIO_MANIFEST.loss.volume).toBe(.85)
		expect(AUDIO_MANIFEST['monster-defeated'].volume).toBe(.85)
	})

	it('can attempt the desired scene again after a provider lifecycle cleanup', () => {
		const backend = new FakeBackend()
		const scheduler = new RecordingScheduler()
		const manager = new AudioManager(backend, { scheduler })
		manager.unlock()
		manager.dispose()
		manager.unlock()
		expect(backend.playCount('menu')).toBe(2)
	})

	it('rotates card sounds without immediately repeating a variant', () => {
		const backend = new FakeBackend()
		const manager = managerWith(backend)
		manager.unlock()
		manager.playCardSound()
		manager.playCardSound()
		manager.playCardSound()
		expect(backend.playCount('card-1')).toBe(2)
		expect(backend.playCount('card-2')).toBe(1)
	})

	it('does not replay duplicate authoritative events', () => {
		const backend = new FakeBackend()
		const manager = managerWith(backend)
		const state = createSandboxScenario('fresh-game').state
		manager.unlock()
		manager.syncGameState(state, 'player-1')
		manager.syncGameState(structuredClone(state), 'player-1')
		expect(backend.playCount('shuffle')).toBe(1)

		const next = structuredClone(state)
		next.events.push({ id: 2, type: 'cards-drawn', message: 'Player drew a card.' })
		next.nextEventId = 3
		manager.syncGameState(next, 'player-1')
		manager.syncGameState(structuredClone(next), 'player-1')
		expect(backend.playCount('card-1')).toBe(1)
	})

	it('plays one shuffle cue for a draw-pile recycle event batch', () => {
		const backend = new FakeBackend()
		const manager = managerWith(backend)
		const state = structuredClone(createSandboxScenario('fresh-game').state)
		manager.unlock()
		manager.syncGameState(state, 'player-1')
		state.events.push(
			{ id: 2, type: 'monsters-rotated', message: 'Monsters rotated.' },
			{ id: 3, type: 'draw-deck-recycled', message: 'The Draw pile recycled.' },
		)
		state.nextEventId = 4
		manager.syncGameState(state, 'player-1')
		expect(backend.playCount('shuffle')).toBe(2)
	})

	it('layers card and monster SFX without stopping gameplay ambience', () => {
		const backend = new FakeBackend()
		const scheduler = new RecordingScheduler()
		const manager = new AudioManager(backend, { scheduler, random: () => 0 })
		const state = structuredClone(createSandboxScenario('fresh-game').state)
		manager.unlock()
		manager.syncGameState(state, 'player-1')
		scheduler.runFirst(AUDIO_TRANSITION_MS)
		state.events.push(
			{ id: 2, type: 'action-played', message: 'An Action was played.' },
			{ id: 3, type: 'monster-defeated', message: 'A Monster was defeated.' },
		)
		state.nextEventId = 4
		manager.syncGameState(state, 'player-1')
		expect(backend.playCount('card-1')).toBe(1)
		expect(backend.playCount('monster-defeated')).toBe(1)
		expect(backend.sounds.get('ambience')?.[0].playing()).toBe(true)
	})

	it('resumes the backend after backgrounding without duplicating the active track', () => {
		const backend = new FakeBackend()
		const manager = managerWith(backend)
		manager.unlock()
		manager.handleVisibilityChange(false)
		expect(backend.sounds.get('menu')?.[0].pauseCount).toBe(1)
		expect(backend.sounds.get('menu')?.[0].playing()).toBe(false)
		manager.handleVisibilityChange(true)
		expect(backend.resumeCount).toBe(2)
		expect(backend.playCount('menu')).toBe(1)
	})

	it('uses the manifest volume as the ceiling for relative bus volume', () => {
		const track = AUDIO_MANIFEST.menu
		expect(getTrackVolume(track)).toBe(track.volume)
		expect(getTrackVolume(track, { music: .5, ambience: 1, sfx: 1 })).toBe(track.volume * .5)
		expect(getTrackVolume(track, { music: 2, ambience: 1, sfx: 1 })).toBe(track.volume)
		expect(getTrackVolume(track, { music: Number.NaN, ambience: 1, sfx: 1 })).toBe(0)
	})

	it('stores independent clamped bus levels without losing them while muted', () => {
		const manager = new AudioManager(new FakeBackend(), {
			enabled: false,
			busVolumes: { music: .6, ambience: .4, sfx: .9 },
		})
		expect(manager.getBusVolume('music')).toBe(.6)
		expect(manager.getBusVolume('ambience')).toBe(.4)
		expect(manager.getBusVolume('sfx')).toBe(.9)
		manager.setBusVolume('music', 4)
		expect(manager.getBusVolume('music')).toBe(1)
		expect(manager.getBusVolume('ambience')).toBe(.4)
		manager.setEnabled(true)
		manager.setEnabled(false)
		expect(manager.getBusVolume('sfx')).toBe(.9)
	})

	it('retargets an in-flight lifecycle fade without shortening it', () => {
		const backend = new FakeBackend()
		let now = 0
		const manager = new AudioManager(backend, { scheduler: inertScheduler(), now: () => now })
		manager.unlock()
		const menu = backend.sounds.get('menu')?.[0]
		expect(menu).toBeDefined()
		const initialFadeCount = menu?.fadeCalls.length ?? 0
		manager.setBusVolume('ambience', .2)
		expect(menu?.fadeCalls).toHaveLength(initialFadeCount)
		manager.setBusVolume('music', .4)
		expect(menu?.playCount).toBe(1)
		expect(menu?.fadeCalls.at(-1)).toMatchObject({
			to: AUDIO_MANIFEST.menu.volume * .4,
			durationMs: AUDIO_TRANSITION_MS,
		})
		now = AUDIO_TRANSITION_MS
		manager.setBusVolume('music', .3)
		expect(menu?.fadeCalls.at(-1)).toMatchObject({
			to: AUDIO_MANIFEST.menu.volume * .3,
			durationMs: AUDIO_VOLUME_RAMP_MS,
		})
	})

	it('controls tavern crowd ambience and tavern music independently', () => {
		const backend = new FakeBackend()
		const scheduler = new RecordingScheduler()
		let now = 0
		const manager = new AudioManager(backend, { scheduler, now: () => now })
		manager.unlock()
		manager.startGameAmbience()
		now = AUDIO_TRANSITION_MS
		scheduler.runFirst(AUDIO_TRANSITION_MS)
		now += AUDIO_TRANSITION_MS

		const ambience = backend.sounds.get('ambience')?.[0]
		const music = backend.sounds.get('tavern-music-1')?.[0]
		expect(ambience).toBeDefined()
		expect(music).toBeDefined()
		const musicFadeCount = music?.fadeCalls.length ?? 0
		manager.setBusVolume('ambience', .25)
		expect(ambience?.fadeCalls.at(-1)).toMatchObject({
			to: AUDIO_MANIFEST.ambience.volume * .25,
		})
		expect(music?.fadeCalls).toHaveLength(musicFadeCount)

		const ambienceFadeCount = ambience?.fadeCalls.length ?? 0
		manager.setBusVolume('music', .4)
		expect(music?.fadeCalls.at(-1)).toMatchObject({
			to: AUDIO_MANIFEST['tavern-music-1'].volume * .4,
		})
		expect(ambience?.fadeCalls).toHaveLength(ambienceFadeCount)
	})

	it('applies the current Music bus when returning to a primed menu voice', () => {
		const backend = new FakeBackend()
		const scheduler = new RecordingScheduler()
		let now = 0
		const manager = new AudioManager(backend, { scheduler, now: () => now })
		manager.unlock()
		now = AUDIO_TRANSITION_MS
		manager.startGameAmbience()
		now += AUDIO_TRANSITION_MS
		scheduler.runFirst(AUDIO_TRANSITION_MS)
		now += AUDIO_TRANSITION_MS
		manager.prepareMenuMusicForUserGesture()
		manager.setBusVolume('music', 0)
		now += AUDIO_TRANSITION_MS
		scheduler.runFirst(AUDIO_TRANSITION_MS)

		const menu = backend.sounds.get('menu')?.[0]
		expect(menu?.playCount).toBe(2)
		expect(menu?.fadeCalls.at(-1)).toMatchObject({ to: 0 })

		now += AUDIO_TRANSITION_MS
		manager.setBusVolume('music', .4)
		expect(menu?.fadeCalls.at(-1)).toMatchObject({
			to: AUDIO_MANIFEST.menu.volume * .4,
			durationMs: AUDIO_VOLUME_RAMP_MS,
		})
	})

	it('updates a native-loop menu voice while Howler reports autoplay recovery', () => {
		const backend = new FakeBackend()
		const manager = managerWith(backend)
		manager.unlock()
		const menu = backend.sounds.get('menu')?.[0]
		expect(menu).toBeDefined()
		if (!menu) return
		menu.reportPlaying = false
		manager.setBusVolume('music', .25)
		expect(menu.getVolume()).toBe(AUDIO_MANIFEST.menu.volume * .25)
	})

	it('keeps gameplay audio until the result presentation is visible', () => {
		const state = structuredClone(createSandboxScenario('fresh-game').state)
		state.mode = 'sudden-death'
		state.phase = 'game-over'
		state.winnerId = 'player-1'
		expect(getGameAudioScene(state, 'player-1', false)).toBe('sudden-death')
		expect(getGameAudioScene(state, 'player-1', true)).toBe('victory')
	})
})

describe('game audio scenes', () => {
	it('selects normal, sudden-death, victory, and loss scenes for the local player', () => {
		const state = structuredClone(createSandboxScenario('fresh-game').state)
		expect(getGameAudioScene(state, 'player-1')).toBe('ambience')
		state.mode = 'sudden-death'
		expect(getGameAudioScene(state, 'player-1')).toBe('sudden-death')
		state.phase = 'game-over'
		state.winnerId = 'player-1'
		expect(getGameAudioScene(state, 'player-1')).toBe('victory')
		expect(getGameAudioScene(state, 'player-2')).toBe('loss')
	})
})
