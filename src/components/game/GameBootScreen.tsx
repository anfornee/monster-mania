import { GAME_ASSET_PATHS } from '../../game/assets/assetManifest'
import type { AssetPreloaderStatus } from '../../game/assets/useAssetPreloader'
import type { AssetLoadProgress } from '../../game/assets/preloadAssets'

interface GameBootScreenProps {
	status: AssetPreloaderStatus
	progress: AssetLoadProgress
	leaving: boolean
	onRetry: () => void
}

function getMilestone(percent: number): string {
	if (percent >= 100) return 'The tavern is ready.'
	if (percent >= 75) return 'Lighting the tavern.'
	if (percent >= 50) return 'Setting the tables.'
	if (percent >= 25) return 'Gathering the hunters.'
	return 'Opening the tavern.'
}

export function GameBootScreen({ status, progress, leaving, onRetry }: GameBootScreenProps) {
	return (
		<div className={`game-boot-screen${leaving ? ' leaving' : ''}`}>
			<div className="boot-content">
				<img src={GAME_ASSET_PATHS.logo} alt="Monster Mania" />
				{status === 'error' ? (
					<div className="boot-error" role="alert">
						<p>Something failed to load.</p>
						<button type="button" className="primary-button" onClick={onRetry}>Retry</button>
					</div>
				) : (
					<>
						<p className="boot-progress" aria-hidden="true">Loading <strong>{progress.percent}%</strong></p>
						<div className="boot-progress-track" aria-hidden="true"><span style={{ width: `${progress.percent}%` }} /></div>
						<p className="sr-only" role="status" aria-live="polite">{getMilestone(progress.percent)}</p>
					</>
				)}
			</div>
		</div>
	)
}
