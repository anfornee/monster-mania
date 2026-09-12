/**
 * Bump this value whenever a public game-visible asset is replaced in place.
 * Stable public filenames then receive a new browser-cache URL without needing
 * path edits throughout the application.
 */
export const GAME_ASSET_VERSION = '2026-09-boot-v1'

export function versionAssetPath(src: string): string {
	const separator = src.includes('?') ? '&' : '?'
	return `${src}${separator}v=${GAME_ASSET_VERSION}`
}
