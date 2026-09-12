import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })

function assert(condition, message) {
	if (!condition) throw new Error(message)
}

try {
	const { CORE_CATALOG } = await server.ssrLoadModule('/src/game/definitions/core.ts')
	const { applyGameAction } = await server.ssrLoadModule('/src/game/engine/applyGameAction.ts')
	const { CORE_ACTION_EFFECTS } = await server.ssrLoadModule('/src/game/engine/actionEffects.ts')
	const { createGame } = await server.ssrLoadModule('/src/game/engine/createGame.ts')
	const { validateGameState } = await server.ssrLoadModule('/src/game/engine/validateGameState.ts')
	const { runComputerTurn } = await server.ssrLoadModule('/src/game/ai/index.ts')
	const { SANDBOX_PRESETS, createSandboxScenario } = await server.ssrLoadModule('/src/game/sandbox/presets.ts')
	const { InMemoryTableService } = await server.ssrLoadModule('/src/game/network/tableService.ts')

	for (const preset of SANDBOX_PRESETS) {
		const scenario = createSandboxScenario(preset)
		const validation = validateGameState(scenario.state, scenario.catalog)
		assert(validation.valid, `${preset}: ${validation.errors.join(' ')}`)
	}

	let actionChain = createSandboxScenario('action-chain').state
	const drawTwo = actionChain.players[0].hand.find((card) => card.definitionId === 'draw-2')
	actionChain = applyGameAction(actionChain, {
		type: 'PLAY_ACTION_CARD',
		playerId: 'player-1',
		cardInstanceId: drawTwo.instanceId,
	}).state
	assert(actionChain.players[0].hand.some((card) => card.definitionId === 'draw-1'), 'Action chain did not draw Draw 1.')
	assert(actionChain.turn.actionPhaseOpen, 'Action chain unexpectedly closed the Action Phase.')

	const expansionCards = { ...CORE_CATALOG.playerCards }
	delete expansionCards['draw-1']
	expansionCards['take-1'] = {
		id: 'take-1',
		name: 'Take 1',
		category: 'action',
		copies: 3,
		assetPath: '/synthetic.png',
		rulesText: 'Take one card from the opponent.',
		effect: { type: 'take-from-opponent', count: 1 },
	}
	const expansionCatalog = { ...CORE_CATALOG, id: 'take-action', playerCards: expansionCards }
	const expansionEffects = {
		...CORE_ACTION_EFFECTS,
		'take-from-opponent': ({ state, playerId, effect }) => {
			const player = state.players.find((candidate) => candidate.id === playerId)
			const opponent = state.players.find((candidate) => candidate.id !== playerId)
			player.hand.push(...opponent.hand.splice(0, effect.count))
		},
	}
	let expansionState = createGame({
		seed: 5,
		startingPlayerId: 'p1',
		players: [
			{ id: 'p1', name: 'P1', controller: 'human-local' },
			{ id: 'p2', name: 'P2', controller: 'human-remote' },
		],
	}, expansionCatalog)
	let takeCard = expansionState.players[0].hand.find((card) => card.definitionId === 'take-1')
	if (!takeCard) {
		const takeLocation = [expansionState.drawPile, expansionState.players[1].hand]
			.find((zone) => zone.some((card) => card.definitionId === 'take-1'))
		const takeIndex = takeLocation.findIndex((card) => card.definitionId === 'take-1')
		const replaced = expansionState.players[0].hand[0]
		takeCard = takeLocation[takeIndex]
		expansionState.players[0].hand[0] = takeCard
		takeLocation[takeIndex] = replaced
	}
	const opponentCount = expansionState.players[1].hand.length
	expansionState = applyGameAction(expansionState, {
		type: 'PLAY_ACTION_CARD',
		playerId: 'p1',
		cardInstanceId: takeCard.instanceId,
	}, expansionCatalog, expansionEffects).state
	assert(expansionState.players[1].hand.length === opponentCount - 1, 'Registered Take 1 effect did not run.')
	assert(validateGameState(expansionState, expansionCatalog, expansionEffects).valid, 'Registered Take 1 state did not validate.')

	let overLimit = createSandboxScenario('draw-2-over-limit').state
	const overLimitAction = overLimit.players[0].hand.find((card) => card.definitionId === 'draw-2')
	overLimit = applyGameAction(overLimit, {
		type: 'PLAY_ACTION_CARD',
		playerId: 'player-1',
		cardInstanceId: overLimitAction.instanceId,
	}).state
	assert(overLimit.players[0].hand.length === 6, 'Draw 2 did not resolve its full draw before cleanup.')
	assert(overLimit.pendingDiscard?.requiredCount === 1, 'Forced discard count is incorrect.')

	let blackHole = createSandboxScenario('black-hole-ready').state
	const ultimate = blackHole.players[0].hand.find((card) => card.definitionId === 'black-hole')
	blackHole = applyGameAction(blackHole, {
		type: 'USE_ULTIMATE_WEAPON',
		playerId: 'player-1',
		cardInstanceId: ultimate.instanceId,
		monsterId: 'thing',
	}).state
	assert(blackHole.players[0].defeatedMonsterIds.includes('thing'), 'Black Hole did not defeat its target.')
	assert(blackHole.discardPile.some((card) => card.definitionId === 'black-hole'), 'Black Hole was not discarded.')

	let infinity = createSandboxScenario('infinity-beast-beatable').state
	infinity = applyGameAction(infinity, {
		type: 'DEFEAT_MONSTER',
		playerId: 'player-1',
		monsterId: CORE_CATALOG.suddenDeathMonster.id,
	}).state
	assert(infinity.phase === 'game-over' && infinity.winnerId === 'player-1', 'Infinity Beast did not end the game.')

	const tableService = new InMemoryTableService({
		createCode: () => 'AB7KQ',
		createToken: (() => {
			let token = 0
			return () => `seat-${++token}`
		})(),
		createSeed: () => 44,
	})
	const host = tableService.createTable('Host')
	assert(host.ok, 'Table creation failed.')
	const guest = tableService.joinTable('AB7KQ', 'Guest')
	assert(guest.ok, 'Table join failed.')
	const hostView = tableService.getClientState(host.value.credentials)
	assert(hostView.ok, 'Host state recovery failed.')
	const guestHandIds = new Set(guest.value.state.myHand.map((card) => card.instanceId))
	const serializedHostView = JSON.stringify(hostView.value)
	assert([...guestHandIds].every((id) => !serializedHostView.includes(id)), 'Opponent hand leaked into a client view.')

	let simulation = createGame({
		seed: 20260912,
		startingPlayerId: 'bot-1',
		players: [
			{ id: 'bot-1', name: 'Bot One', controller: 'computer' },
			{ id: 'bot-2', name: 'Bot Two', controller: 'computer' },
		],
	})
	let turns = 0
	while (simulation.phase !== 'game-over' && turns < 500) {
		const playerId = simulation.pendingDiscard?.playerId ?? simulation.turn.currentPlayerId
		const result = runComputerTurn(simulation, playerId)
		assert(result.ok && result.actions.length > 0, result.error ?? 'Computer made no progress.')
		simulation = result.state
		const validation = validateGameState(simulation)
		assert(validation.valid, validation.errors.join(' '))
		turns += 1
	}
	assert(simulation.phase === 'game-over', 'Seeded complete match did not finish within 500 turns.')

	process.stdout.write(`Rules smoke passed: ${SANDBOX_PRESETS.length} presets, Table privacy, and a ${turns}-turn complete match.\n`)
} finally {
	await server.close()
}
