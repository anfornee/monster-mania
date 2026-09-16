import { describe, expect, it } from 'vitest'
import { createSandboxScenario } from '../sandbox/presets'
import { AudioManager, type AudioScheduler } from './AudioManager'
import type { AudioTrackDefinition } from './audioManifest'
import type { AudioPlaybackBackend, AudioSound } from './audioPlayback'
import { getGameAudioScene } from './gameAudio'

class FakeSound implements AudioSound {
	playCount = 0
	loadCount = 0
	stopCount = 0
	private nextId = 1
	private readonly active = new Set<number>()

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
	once(): void {}
	load(): void { this.loadCount += 1 }
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
		expect(backend.playCount('sudden-death')).toBe(1)
		expect(backend.playCount('victory')).toBe(1)
		expect(backend.playCount('loss')).toBe(1)
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
