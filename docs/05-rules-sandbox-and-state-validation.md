# Monster Mania — Rules Sandbox & State Validation

> **Purpose:** Define the permanent development sandbox, legal-state builders, invariant checks, and defensive validation strategy for Monster Mania.  
> **Audience:** Development and testing only.  
> **Principle:** The sandbox should make difficult game states easy to reproduce without weakening confidence in the rules engine.

---

# 1. Why the Rules Sandbox Exists

Monster Mania has several gameplay states that would be slow or unreliable to reach by manually playing complete matches.

Examples:

- A player at exactly 5 cards who wants to skip
- A Draw 2 that pushes a hand above the limit
- The shared draw pile becoming empty
- Monster rotation during deck recycling
- Exactly 3 Monsters remaining
- A specific Monster being beatable
- A specific Monster being intentionally unbeatable
- Black Hole usage
- A tied end-game score
- Sudden Death
- Infinity Beast victory
- Persistence recovery from unusual phases

The Rules Sandbox should allow these situations to be constructed directly.

It is a permanent development tool, not throwaway scaffolding.

---

# 2. Core Rule

The sandbox UI should **not directly mutate arbitrary game state**.

Prefer tested state-builder functions.

Example:

```ts
const state = createSandboxState();

const nextState = giveCardToPlayer(
	state,
	'player-1',
	'grenade',
);
```

The UI is only a convenient interface over those helpers.

This keeps sandbox behavior reproducible and testable.

---

# 3. Suggested Sandbox Module

```text
src/
	dev/
		RulesSandbox.tsx
		SandboxControls.tsx

	game/
		sandbox/
			builders.ts
			presets.ts
			types.ts
			validateGameState.ts
```

---

# 4. Sandbox Modes

Use two explicit modes.

```ts
export type SandboxMode =
	| 'legal'
	| 'unsafe';
```

---

## Legal Mode

Legal mode must preserve normal game invariants.

Use it for almost all routine testing.

Examples:

- Give Player 1 a Grenade
- Set Player 2 to 5 cards
- Make Ground Worm beatable
- Put the game into final-three state
- Force a valid score tie
- Enter valid Sudden Death
- Empty the draw pile while preserving all card counts

Every resulting state should pass:

```ts
validateGameState(state)
```

---

## Unsafe Mode

Unsafe mode is intentionally allowed to create impossible or corrupted states.

Examples:

- Duplicate card instance IDs
- Missing cards
- Impossible phase combinations
- Empty draw and discard piles
- Unknown Monster IDs
- Hand above normal limits
- Invalid current player index

Unsafe mode is only for:

- defensive tests
- error boundaries
- migration testing
- validator tests

The UI should visually distinguish unsafe mode.

Do not accidentally use unsafe helpers in normal gameplay code.

---

# 5. Recommended State Builders

Keep state builders small and composable.

Suggested functions:

```ts
createSandboxState()
setCurrentPlayer()
setPhase()
giveCardToPlayer()
removeCardFromPlayer()
setPlayerHand()
setDrawPile()
setDiscardPile()
setFaceUpMonsters()
setMonsterDeck()
setDefeatedMonsters()
setScoreScenario()
forceFinalThree()
forceDrawPileRecycle()
makeMonsterBeatable()
makeMonsterUnbeatable()
giveBlackHole()
forceTie()
prepareSuddenDeath()
```

---

# 6. Unique Card Instances

Repeated cards must still have unique instance IDs.

Example:

```ts
export interface PlayerCardInstance {
	instanceId: string;
	cardId: PlayerCardId;
}
```

Three Bow cards are three different instances:

```ts
[
	{
		instanceId: 'card-001',
		cardId: 'bow',
	},
	{
		instanceId: 'card-002',
		cardId: 'bow',
	},
	{
		instanceId: 'card-003',
		cardId: 'bow',
	},
]
```

Sandbox builders must preserve this rule.

---

# 7. Game-State Validation

Create one central validator:

```ts
export function validateGameState(
	state: GameState,
): ValidationResult
```

Suggested result:

```ts
export interface ValidationResult {
	valid: boolean;
	errors: GameStateValidationError[];
	warnings: GameStateValidationWarning[];
}
```

This validator should be reusable by:

- unit tests
- sandbox builders
- development-mode assertions
- persistence restoration
- future multiplayer server validation
- migration tools

---

# 8. Core Invariants

The validator should check at least the following.

---

## Card Instance Integrity

- Every player card instance has an `instanceId`
- Every `instanceId` is unique
- Every `cardId` maps to a known player-card definition
- No card instance exists in two locations simultaneously

Locations include:

- Player 1 hand
- Player 2 hand
- Draw pile
- Discard pile
- Removed-from-game zone if introduced

---

## Shared Deck Conservation

For legal-mode states:

The total number of player card instances across all legal zones should equal the expected shared-deck count.

Current total:

```text
24 cards
```

This should include:

```text
player hands
+ draw pile
+ discard pile
+ valid removed cards
```

If Black Hole is removed for Sudden Death, account for that explicitly.

Avoid silently losing it.

---

## Monster Conservation

Every regular Monster should exist in exactly one legal location:

- Monster deck
- Face-up board
- Player 1 defeated pile
- Player 2 defeated pile

There are:

```text
16 regular Monsters
```

The Infinity Beast is separate and should not be counted among them.

---

## Monster Uniqueness

- No regular Monster ID may appear twice
- Infinity Beast may exist only in appropriate Sudden Death state
- Infinity Beast must never appear inside the regular Monster deck

---

## Turn Integrity

- `currentPlayerIndex` resolves to a real player
- Exactly one current player exists
- Only the current player can perform normal turn actions
- Turn handoff state should not expose an active playable hand

---

## Phase Integrity

The current phase must agree with the surrounding state.

Examples:

### `playing`

- Active player exists
- Active player hand may be visible
- No unresolved forced discard exists

### `forced-discard-after-draw`

- Active player's hand exceeds current hand limit
- Required discard count is greater than zero

### `forced-discard-before-skip`

- Player is resolving skip at hand limit
- Required discard selection is exactly one card

### `turn-handoff`

- Normal actions are unavailable
- No player's private hand should be considered revealed

### `sudden-death`

- Infinity Beast is active
- Black Hole is removed from play
- Hand limit is 4

### `game-over`

- Winner exists

---

# 9. Hand-Limit Validation

Normal game:

```text
maximum hand size = 5
```

Sudden Death:

```text
maximum hand size = 4
```

Exceptions are valid only during explicit forced-discard phases.

Example:

A player may temporarily have 6 cards after Draw 2 if the game phase is:

```ts
'forced-discard-after-draw'
```

That is a legal transient state.

A player with 6 cards during normal `playing` state is not legal.

---

# 10. Beatable-Monster Presets

A helper should make a selected Monster definitely beatable.

Example:

```ts
makeMonsterBeatable(
	state,
	{
		playerId: 'player-1',
		monsterId: 'ground-worm',
	},
)
```

For Ground Worm:

```text
Grenade + Gun + Mace
```

The resulting player hand must contain those Weapon cards.

Other hand cards may vary.

Test:

```ts
expect(
	canDefeatMonster(
		result,
		'player-1',
		'ground-worm',
	),
).toBe(true);
```

---

# 11. Unbeatable-Monster Presets

A helper should guarantee the selected player is missing at least one required Weapon.

Example:

```ts
makeMonsterUnbeatable(
	state,
	{
		playerId: 'player-1',
		monsterId: 'thing',
	},
)
```

The helper should not rely on luck.

Test:

```ts
expect(
	canDefeatMonster(
		result,
		'player-1',
		'thing',
	),
).toBe(false);
```

---

# 12. Draw-Pile Recycle Presets

Support at least two presets.

---

## Recycle With Monster Rotation

Set up:

- Shared draw pile empty or one draw away from empty
- Shared discard pile contains cards
- At least 4 undefeated regular Monsters remain
- 2 Monsters are currently face-up

Expected:

- Face-up Monsters rotate to bottom
- Replacement Monsters appear
- Discard pile becomes new shuffled draw pile

---

## Recycle Without Monster Rotation

Set up:

- Shared draw pile empty or one draw away from empty
- Shared discard pile contains cards
- Fewer than 4 undefeated Monsters remain

Expected:

- Face-up Monsters stay
- Discard pile becomes new shuffled draw pile

---

# 13. Final-Three Preset

Create a deterministic helper:

```ts
forceFinalThree(state)
```

Expected result:

- Exactly 3 undefeated regular Monsters remain
- All 3 are face-up
- Monster deck contains no additional undefeated regular Monsters
- Defeated piles account for the other 13 regular Monsters

This state must pass monster-conservation validation.

---

# 14. Tie Preset

Create:

```ts
forceTie(state)
```

This should construct a valid end-of-regular-game state where:

- All regular Monsters are defeated
- Both players have equal scores
- Both players are tied for highest score
- Sudden Death has not yet started unless requested

The helper should use real Monster point totals, not directly fake numeric score fields if score is derived from defeated Monsters.

---

# 15. Sudden Death Preset

Create:

```ts
prepareSuddenDeath(state)
```

Expected:

- Valid tied score condition
- Infinity Beast active
- Black Hole removed from all playable zones
- Current hand limit = 4
- Players above 4 resolved or explicitly placed into required setup discard
- Infinity Beast requires:
	- Grenade
	- Sword
	- Gun

The helper should produce a state from which Sudden Death can be played normally.

---

# 16. Suggested Sandbox Presets

The UI can expose named presets:

```ts
export type SandboxPreset =
	| 'fresh-game'
	| 'hand-limit-skip'
	| 'draw-2-over-limit'
	| 'ground-worm-beatable'
	| 'thing-beatable'
	| 'black-hole-ready'
	| 'recycle-with-rotation'
	| 'recycle-without-rotation'
	| 'final-three'
	| 'score-tie'
	| 'sudden-death'
	| 'infinity-beast-beatable';
```

These are much faster than repeatedly manipulating individual controls.

---

# 17. Testing Builders

Every legal builder should have tests.

Example:

```ts
describe('makeMonsterBeatable', () => {
	it('produces a valid state', () => {
		const state = makeMonsterBeatable(
			createSandboxState(),
			{
				playerId: 'player-1',
				monsterId: 'ground-worm',
			},
		);

		expect(
			validateGameState(state).valid,
		).toBe(true);
	});

	it('makes the target monster beatable', () => {
		const state = makeMonsterBeatable(
			createSandboxState(),
			{
				playerId: 'player-1',
				monsterId: 'ground-worm',
			},
		);

		expect(
			canDefeatMonster(
				state,
				'player-1',
				'ground-worm',
			),
		).toBe(true);
	});
});
```

---

# 18. Global Sandbox Test

A powerful regression test is to validate every preset.

```ts
for (
	const preset of LEGAL_SANDBOX_PRESETS
) {
	it(`${preset} creates valid state`, () => {
		const state =
			createStateFromPreset(preset);

		const result =
			validateGameState(state);

		expect(result.errors).toEqual([]);
		expect(result.valid).toBe(true);
	});
}
```

This becomes especially valuable as the game evolves.

If a new rule makes an old preset invalid, the test fails immediately.

---

# 19. Development Assertions

In development builds, consider validating state after every game action.

Example:

```ts
if (import.meta.env.DEV) {
	const validation =
		validateGameState(nextState);

	if (!validation.valid) {
		console.error(
			'Invalid Monster Mania state',
			validation.errors,
			nextState,
		);
	}
}
```

Do not run expensive exhaustive validation unnecessarily in production.

---

# 20. Persistence Validation

When restoring a saved game:

1. Parse stored JSON.
2. Check schema version.
3. Run any required migration.
4. Run `validateGameState`.
5. Only resume if the result is safe.

If invalid:

- Preserve error detail for debugging
- Do not crash the app
- Offer starting a new game

---

# 21. Future Multiplayer Value

This work is intentionally useful beyond local development.

When online lobbies are added, the server can:

1. Receive a `GameAction`
2. Validate that the player may perform it
3. Apply the game reducer
4. Run `validateGameState`
5. Save authoritative state
6. Broadcast filtered state

The same core validation code can therefore protect:

- local games
- tests
- saved games
- online multiplayer

---

# 22. Definition of Done

The sandbox/validation milestone is complete when:

- [ ] Legal and unsafe modes exist
- [ ] Core state builders are pure/testable
- [ ] Named presets cover important edge cases
- [ ] `validateGameState()` exists
- [ ] Card-instance uniqueness is validated
- [ ] Shared deck conservation is validated
- [ ] Monster conservation is validated
- [ ] Phase invariants are validated
- [ ] Hand-limit transient states are validated
- [ ] Every legal preset passes validation
- [ ] Tie preset creates a real score tie
- [ ] Sudden Death preset is legal
- [ ] Rules Sandbox UI uses builders instead of arbitrary mutation
- [ ] Saved-state restoration runs validation
- [ ] Development builds can surface invalid-state errors
