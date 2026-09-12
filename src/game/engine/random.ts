export function nextRandom(seed: number): { seed: number; value: number } {
	let value = seed | 0
	value ^= value << 13
	value ^= value >>> 17
	value ^= value << 5
	const nextSeed = value >>> 0 || 0x9e3779b9
	return { seed: nextSeed, value: nextSeed / 0x100000000 }
}

export function shuffleWithSeed<T>(values: T[], seed: number): { values: T[]; seed: number } {
	const shuffled = [...values]
	let currentSeed = seed || 0x9e3779b9
	for (let index = shuffled.length - 1; index > 0; index -= 1) {
		const random = nextRandom(currentSeed)
		currentSeed = random.seed
		const swapIndex = Math.floor(random.value * (index + 1))
		const item = shuffled[index]
		shuffled[index] = shuffled[swapIndex]
		shuffled[swapIndex] = item
	}
	return { values: shuffled, seed: currentSeed }
}
