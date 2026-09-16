import { Howl, Howler, type HowlOptions } from 'howler'
import type { AudioTrackDefinition } from './audioManifest'

export type AudioPlaybackEvent = 'play' | 'end'

export interface AudioSound {
	play: () => number
	stop: (id?: number) => void
	fade: (from: number, to: number, durationMs: number, id: number) => void
	volume: (volume: number, id?: number) => void
	getVolume: (id?: number) => number
	playing: (id?: number) => boolean
	duration: (id?: number) => number
	once: (event: AudioPlaybackEvent, callback: (id: number) => void, id?: number) => void
	load: () => void
}

export interface AudioPlaybackBackend {
	create: (track: AudioTrackDefinition, initialVolume: number) => AudioSound
	resume: () => void
}

class HowlerSound implements AudioSound {
	private readonly howl: Howl
	private readonly activeIds = new Set<number>()

	constructor(howl: Howl) {
		this.howl = howl
	}

	play(): number {
		const id = this.howl.play()
		this.activeIds.add(id)
		this.howl.once('end', () => this.activeIds.delete(id), id)
		this.howl.once('playerror', () => {
			this.howl.once('unlock', () => {
				if (this.activeIds.has(id)) this.howl.play(id)
			})
		}, id)
		return id
	}

	stop(id?: number): void {
		if (id === undefined) this.activeIds.clear()
		else this.activeIds.delete(id)
		this.howl.stop(id)
	}

	fade(from: number, to: number, durationMs: number, id: number): void {
		this.howl.fade(from, to, durationMs, id)
	}

	volume(volume: number, id?: number): void {
		if (id === undefined) this.howl.volume(volume)
		else this.howl.volume(volume, id)
	}

	getVolume(id?: number): number {
		return id === undefined ? this.howl.volume() : this.howl.volume(id) as number
	}

	playing(id?: number): boolean {
		return this.howl.playing(id)
	}

	duration(id?: number): number {
		return this.howl.duration(id)
	}

	once(event: AudioPlaybackEvent, callback: (id: number) => void, id?: number): void {
		this.howl.once(event, callback, id)
	}

	load(): void {
		this.howl.load()
	}
}

export class HowlerPlaybackBackend implements AudioPlaybackBackend {
	create(track: AudioTrackDefinition, initialVolume: number): AudioSound {
		const longForm = track.bus !== 'sfx'
		const options: HowlOptions = {
			src: [track.src],
			format: ['mp3'],
			html5: longForm,
			loop: track.loopMode === 'native',
			// The manager explicitly prepares SFX after the critical loader finishes.
			// Keeping Howler lazy avoids a constructor request followed by load().
			preload: false,
			volume: initialVolume,
			pool: longForm ? 2 : 5,
		}
		return new HowlerSound(new Howl(options))
	}

	resume(): void {
		if (Howler.usingWebAudio && Howler.ctx?.state === 'suspended') {
			void Howler.ctx.resume().catch(() => undefined)
		}
	}
}
