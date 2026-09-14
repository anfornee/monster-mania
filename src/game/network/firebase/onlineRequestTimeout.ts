import { OnlineTableError } from './onlineTable'

export const ONLINE_REQUEST_TIMEOUT_MS = 20_000

export function withOnlineRequestTimeout<T>(
	request: Promise<T>,
	message: string,
	timeoutMs = ONLINE_REQUEST_TIMEOUT_MS,
): Promise<T> {
	return new Promise((resolve, reject) => {
		const timeout = globalThis.setTimeout(() => {
			reject(new OnlineTableError('FIREBASE_UNAVAILABLE', message))
		}, timeoutMs)
		void request.then(
			(value) => {
				globalThis.clearTimeout(timeout)
				resolve(value)
			},
			(error: unknown) => {
				globalThis.clearTimeout(timeout)
				reject(error)
			},
		)
	})
}
