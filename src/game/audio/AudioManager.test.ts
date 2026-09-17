import { describe, expect, it } from 'vitest'
import { createSandboxScenario } from '../sandbox/presets'
import { AudioManager, type AudioScheduler } from './AudioManager'
import {
	AUDIO_MANIFEST,
	AUDIO_MUTE_FADE_MS,
	AUDIO_TRANSITION_MS,
	TAVERN_MUSIC_IDS,
	type AudioTrackDefinition,
} from './audioManifest'
import type { AudioPlaybackBackend, AudioPlaybackEvent, AudioSound } from './audioPlayback'
import { getGameAudioScene } from './gameAudio'

class FakeSound implements AudioSound {
	playCount = 0
	loadCount = 0
	stopCount = 0
	private nextId = 1
	private readonly active = new Set<number>()
	private readonly endListeners = new Map<number, Array<(id: number) => void>>()

	play(): number {
		const id = this.nextId
		this.nextId += 1
		this.playCount += 1
		this.active.add(id)
		return id
	}

	stop(id?: number): void {
		this.stopCount += 1
		if (id === undefined) this.active.clear()
		else this.active.delete(id)
	}

	fade(): void {}
	volume(): void {}
	getVolume(): number { return 1 }
	playing(id?: number): boolean {
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

	create(track: AudioTrackDefinition): AudioSound {
		const sound = new FakeSound()
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
	it('does not execute playback commands while disabled', () => {
		const backend = new FakeBackend()
		const manager = managerWith(backend, false)
		manager.startGameAmbience()
		manager.unlock()
		manager.playCardSound()
		manager.playShuffleSound()
		expect(backend.playCount('ambience')).toBe(0)
		expect(backend.playCount('shuffle')).toBe(0)
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
		const manager = managerWith(backend)
		manager.unlock()
		manager.startGameAmbience()
		manager.startSuddenDeathMusic()
		manager.playVictoryMusic()
		manager.playLossMusic()
		manager.playMenuMusic()
		expect(backend.playCount('menu')).toBe(2)
		expect(backend.playCount('ambience')).toBe(1)
		expect(backend.playCount('tavern-music-1')).toBe(1)
		expect(backend.playCount('sudden-death')).toBe(1)
		expect(backend.playCount('victory')).toBe(1)
		expect(backend.playCount('loss')).toBe(1)
	})

	it('plays all tavern music as a playlist and stops it for priority music', () => {
		const backend = new FakeBackend()
		const scheduler = new RecordingScheduler()
		const manager = new AudioManager(backend, { scheduler })
		manager.unlock()
		manager.startGameAmbience()

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
		expect(AUDIO_MANIFEST.ambience.volume).toBe(.85)
		expect(AUDIO_MANIFEST.ambience.approximateDurationMs).toBe(21_000)
		expect(AUDIO_MANIFEST.ambience.crossfadeMs).toBe(12_000)
		for (const trackId of TAVERN_MUSIC_IDS) {
			expect(AUDIO_MANIFEST[trackId].volume).toBe(.70)
		}
		expect(AUDIO_MANIFEST['sudden-death'].volume).toBe(.84)
		expect(AUDIO_MANIFEST['sudden-death'].crossfadeMs).toBe(5_000)
		expect(AUDIO_MANIFEST.victory.volume).toBe(.85)
		expect(AUDIO_MANIFEST.loss.volume).toBe(.85)
		expect(AUDIO_MANIFEST['monster-defeated'].volume).toBe(.85)
	})

	it('can attempt the desired scene again after a provider lifecycle cleanup', () => {
		const backend = new FakeBackend()
		const manager = managerWith(backend)
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
		const manager = managerWith(backend)
		const state = structuredClone(createSandboxScenario('fresh-game').state)
		manager.unlock()
		manager.syncGameState(state, 'player-1')
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
		manager.handleVisibilityChange(true)
		expect(backend.resumeCount).toBe(2)
		expect(backend.playCount('menu')).toBe(1)
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
