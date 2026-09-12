import { useCallback, useEffect, useState } from 'react'
import type { GameAsset } from './assetManifest'
import {
	calculateAssetProgress,
	preloadAssets,
	type AssetLoadFailure,
	type AssetLoadProgress,
} from './preloadAssets'

export type AssetPreloaderStatus = 'loading' | 'ready' | 'error'

interface AssetPreloaderState {
	status: AssetPreloaderStatus
	progress: AssetLoadProgress
	failures: AssetLoadFailure[]
}

export function useAssetPreloader(assets: GameAsset[]) {
	const [attempt, setAttempt] = useState(0)
	const [state, setState] = useState<AssetPreloaderState>(() => ({
		status: 'loading',
		progress: calculateAssetProgress(assets.length, 0, 0),
		failures: [],
	}))

	useEffect(() => {
		let active = true
		void preloadAssets(assets, {
			onProgress: (progress) => {
				if (active) setState((current) => ({ ...current, progress }))
			},
		}).then((result) => {
			if (!active) return
			if (result.failures.length > 0) {
				console.warn('Monster Mania asset preload failures', result.failures)
			}
			setState({
				status: result.hasCriticalFailures ? 'error' : 'ready',
				progress: result.progress,
				failures: result.failures,
			})
		})
		return () => {
			active = false
		}
	}, [assets, attempt])

	const retry = useCallback(() => {
		setState({
			status: 'loading',
			progress: calculateAssetProgress(assets.length, 0, 0),
			failures: [],
		})
		setAttempt((current) => current + 1)
	}, [assets])

	return { ...state, retry }
}
