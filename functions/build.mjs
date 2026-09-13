import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const functionsDirectory = dirname(fileURLToPath(import.meta.url))

await build({
	absWorkingDir: functionsDirectory,
	entryPoints: ['./src/index.ts'],
	outfile: 'lib/index.js',
	bundle: true,
	platform: 'node',
	target: 'node22',
	format: 'esm',
	packages: 'external',
})
