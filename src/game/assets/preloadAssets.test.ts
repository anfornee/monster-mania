import { describe, expect, it, vi } from 'vitest'
import { CORE_CATALOG } from '../definitions/core'
import { GAME_ASSETS, type GameAsset } from './assetManifest'
import {
	calculateAssetProgress,
	deduplicateAssets,
	preloadAudio,
	preloadAssets,
	preloadImage,
} from './preloadAssets'

const asset = (id: string, critical = false): GameAsset => ({
	id,
	src: `/assets/${id}.png`,
	group: critical ? 'menu' : 'game',
	critical,
	kind: 'image',
})

describe('asset manifest', () => {
	it('derives all catalog art instead of duplicating card paths', () => {
		const sources = new Set(GAME_ASSETS.map(({ src }) => src))
		for (const card of Object.values(CORE_CATALOG.playerCards)) {
			expect(sources.has(card.assetPath)).toBe(true)
		}
		for (const monster of Object.values(CORE_CATALOG.regularMonsters)) {
			expect(sources.has(monster.assetPath)).toBe(true)
		}
		expect(sources.has(CORE_CATALOG.suddenDeathMonster.assetPath)).toBe(true)
	})

	it('deduplicates sources and preserves critical importance', () => {
		const duplicate = { ...asset('same', true), src: asset('same').src }
		const unique = deduplicateAssets([asset('same'), duplicate])
		expect(unique).toHaveLength(1)
		expect(unique[0].critical).toBe(true)
	})
})

describe('asset loading', () => {
	it('calculates progress from actual completed attempts', () => {
		expect(calculateAssetProgress(4, 3, 1)).toEqual({
			total: 4,
			completed: 3,
			failed: 1,
			percent: 75,
		})
		expect(calculateAssetProgress(0, 0, 0).percent).toBe(100)
	})

	it('reports real all-success progress through completion', async () => {
		const updates: number[] = []
		const result = await preloadAssets([asset('one'), asset('two')], {
			concurrency: 1,
			loadAsset: async () => undefined,
			onProgress: (progress) => updates.push(progress.percent),
		})
		expect(updates).toEqual([0, 50, 100])
		expect(result).toMatchObject({
			progress: { total: 2, completed: 2, failed: 0, percent: 100 },
			hasCriticalFailures: false,
		})
	})

	it('finishes with a recorded non-critical failure', async () => {
		const result = await preloadAssets([asset('optional'), asset('good')], {
			concurrency: 1,
			loadAsset: async (entry) => {
				if (entry.id === 'optional') throw new Error('missing')
			},
		})
		expect(result.progress).toEqual({ total: 2, completed: 2, failed: 1, percent: 100 })
		expect(result.hasCriticalFailures).toBe(false)
		expect(result.failures[0].asset.id).toBe('optional')
	})

	it('distinguishes a critical failure without hanging', async () => {
		const result = await preloadAssets([asset('menu', true)], {
			loadAsset: async () => { throw new Error('offline') },
		})
		expect(result.progress.percent).toBe(100)
		expect(result.hasCriticalFailures).toBe(true)
	})

	it('allows failed work to succeed on retry', async () => {
		let shouldFail = true
		const loadAsset = async () => {
			if (shouldFail) throw new Error('first attempt')
		}
		const first = await preloadAssets([asset('menu', true)], { loadAsset })
		shouldFail = false
		const retry = await preloadAssets([asset('menu', true)], { loadAsset })
		expect(first.hasCriticalFailures).toBe(true)
		expect(retry).toMatchObject({ hasCriticalFailures: false, progress: { percent: 100, failed: 0 } })
	})

	it('waits for image decode after load', async () => {
		const decode = vi.fn(async () => undefined)
		const image = {
			onload: null as (() => void) | null,
			onerror: null as (() => void) | null,
			decode,
			set src(_value: string) {
				queueMicrotask(() => this.onload?.())
			},
		}
		await preloadImage('/asset.png', { imageFactory: () => image, timeoutMs: 100 })
		expect(decode).toHaveBeenCalledOnce()
	})

	it('fully reads short audio before marking it ready', async () => {
		const arrayBuffer = vi.fn(async () => new ArrayBuffer(8))
		await preloadAudio('/sound.mp3', {
			fetcher: async () => ({ ok: true, status: 200, arrayBuffer }),
		})
		expect(arrayBuffer).toHaveBeenCalledOnce()
	})

	it('reports failed audio responses', async () => {
		await expect(preloadAudio('/missing.mp3', {
			fetcher: async () => ({
				ok: false,
				status: 404,
				arrayBuffer: async () => new ArrayBuffer(0),
			}),
		})).rejects.toThrow('Failed to load audio (404)')
	})

	it('times out audio requests instead of holding the boot screen forever', async () => {
		await expect(preloadAudio('/stalled.mp3', {
			fetcher: () => new Promise<never>(() => undefined),
			timeoutMs: 1,
		})).rejects.toThrow('Timed out loading audio')
	})
})
