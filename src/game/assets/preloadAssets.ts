import type { GameAsset } from './assetManifest'

export interface AssetLoadFailure {
	asset: GameAsset
	error: Error
}

export interface AssetLoadProgress {
	total: number
	completed: number
	failed: number
	percent: number
}

export interface AssetLoadResult {
	progress: AssetLoadProgress
	failures: AssetLoadFailure[]
	hasCriticalFailures: boolean
}

interface PreloadableImage {
	onload: (() => void) | null
	onerror: (() => void) | null
	src: string
	decode?: () => Promise<void>
}

export interface PreloadImageOptions {
	imageFactory?: () => PreloadableImage
	timeoutMs?: number
}

export interface PreloadAssetsOptions {
	concurrency?: number
	onProgress?: (progress: AssetLoadProgress) => void
	loadAsset?: (asset: GameAsset) => Promise<void>
}

const sharedImageRequests = new Map<string, Promise<void>>()

export function calculateAssetProgress(total: number, completed: number, failed: number): AssetLoadProgress {
	return {
		total,
		completed,
		failed,
		percent: total === 0 ? 100 : Math.round((completed / total) * 100),
	}
}

export function deduplicateAssets(assets: GameAsset[]): GameAsset[] {
	const unique = new Map<string, GameAsset>()
	for (const asset of assets) {
		const existing = unique.get(asset.src)
		if (!existing) {
			unique.set(asset.src, asset)
			continue
		}
		if (asset.critical && !existing.critical) {
			unique.set(asset.src, { ...existing, critical: true })
		}
	}
	return [...unique.values()]
}

export function preloadImage(src: string, options: PreloadImageOptions = {}): Promise<void> {
	const imageFactory = options.imageFactory ?? (() => new Image())
	const timeoutMs = options.timeoutMs ?? 30_000
	return new Promise((resolve, reject) => {
		const image = imageFactory()
		let settled = false
		const finish = (error?: Error) => {
			if (settled) return
			settled = true
			globalThis.clearTimeout(timeout)
			image.onload = null
			image.onerror = null
			if (error) reject(error)
			else resolve()
		}
		const timeout = globalThis.setTimeout(
			() => finish(new Error(`Timed out loading image: ${src}`)),
			timeoutMs,
		)
		image.onerror = () => finish(new Error(`Failed to load image: ${src}`))
		image.onload = async () => {
			try {
				await image.decode?.()
			} catch {
				// Some browsers reject decode after a successful load; the image is still usable.
			}
			finish()
		}
		image.src = src
	})
}

export function preloadImageOnce(src: string): Promise<void> {
	const existing = sharedImageRequests.get(src)
	if (existing) return existing
	const request = preloadImage(src).catch((error) => {
		sharedImageRequests.delete(src)
		throw error
	})
	sharedImageRequests.set(src, request)
	return request
}

export async function preloadAssets(
	assets: GameAsset[],
	options: PreloadAssetsOptions = {},
): Promise<AssetLoadResult> {
	const uniqueAssets = deduplicateAssets(assets)
	const concurrency = Math.max(1, Math.min(options.concurrency ?? 6, uniqueAssets.length || 1))
	const loadAsset = options.loadAsset ?? ((asset: GameAsset) => preloadImageOnce(asset.src))
	let cursor = 0
	let completed = 0
	const failures: AssetLoadFailure[] = []
	options.onProgress?.(calculateAssetProgress(uniqueAssets.length, 0, 0))

	const worker = async () => {
		while (cursor < uniqueAssets.length) {
			const asset = uniqueAssets[cursor]
			cursor += 1
			try {
				await loadAsset(asset)
			} catch (error) {
				failures.push({
					asset,
					error: error instanceof Error ? error : new Error('Unknown asset loading failure.'),
				})
			}
			completed += 1
			options.onProgress?.(
				calculateAssetProgress(uniqueAssets.length, completed, failures.length),
			)
		}
	}

	await Promise.all(Array.from({ length: concurrency }, () => worker()))
	const progress = calculateAssetProgress(uniqueAssets.length, completed, failures.length)
	return {
		progress,
		failures,
		hasCriticalFailures: failures.some(({ asset }) => asset.critical),
	}
}

export function resetSharedAssetRequestsForTests(): void {
	sharedImageRequests.clear()
}
