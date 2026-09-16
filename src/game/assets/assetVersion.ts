/**
 * Bump this value whenever public game-visible image or audio is replaced in place.
 * Stable public filenames then receive a new browser-cache URL without needing
 * path edits throughout the application.
 */
export const GAME_ASSET_VERSION = '2026-09-audio-v2'

export function versionAssetPath(src: string): string {
	const separator = src.includes('?') ? '&' : '?'
	return `${src}${separator}v=${GAME_ASSET_VERSION}`
}
