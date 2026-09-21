# Monster Mania — Rules Sandbox & State Validation

> **Purpose:** Define the permanent development sandbox, legal-state builders, invariant checks, and defensive validation strategy for Monster Mania.  
> **Audience:** Development and testing only.  
> **Principle:** The sandbox should make difficult game states easy to reproduce without weakening confidence in the rules engine.

---

# 1. Why the Rules Sandbox Exists

Monster Mania has several gameplay states that would be slow or unreliable to reach by manually playing complete matches.

Examples:

- A player at exactly 5 cards who wants to skip
- A Draw 2 Action that pushes a hand above the limit
- An Action chain where one Draw Action produces another Action
- Attempting to play an Action after Weapon play has begun
- The shared Draw pile becoming empty
- Monster rotation during deck recycling
- Exactly 3 Monsters remaining
- A specific Monster being beatable
- A specific Monster being intentionally unbeatable
- Ultimate Weapon usage
- Black Hole usage
- A tied end-game score
- Sudden Death
- Infinity Beast victory
- Persistence recovery from unusual phases
- Alternate legal Monster mixes with a different point distribution

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
- Give Player 1 a Draw 2 Action
- Set Player 2 to 5 cards
- Create a chainable Action scenario
- Make Ground Worm beatable
- Put the game into final-three state
- Force a valid score tie
- Enter valid Sudden Death
- Empty the Draw pile while preserving all card counts
- Build an alternate legal 17-Monster mix

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
- Wrong category totals
- Impossible phase combinations
- Empty Draw and discard piles
- Unknown Monster IDs
- Unknown Action-effect IDs
- Hand above normal limits
- Invalid current player index
- Action Phase marked open after Monster-defeat play begins

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
setActionPhaseOpen()
giveCardToPlayer()
giveActionCard()
giveUltimateWeapon()
removeCardFromPlayer()
setPlayerHand()
setDrawPile()
setDiscardPile()
setRemovedCards()
setFaceUpMonsters()
setMonsterDeck()
setDefeatedMonsters()
setScoreScenario()
forceFinalThree()
forceDrawPileRecycle()
makeMonsterBeatable()
makeMonsterUnbeatable()
buildActionChain()
forceTie()
prepareSuddenDeath()
```

Core convenience wrappers may include:

```ts
giveDraw1()
giveDraw2()
giveBlackHole()
```

These should wrap generic card-giving helpers rather than create separate state systems.

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
- Every player-card definition has a recognized category
- Action cards reference recognized Action effects
- No card instance exists in two locations simultaneously

Locations include:

- Player 1 hand
- Player 2 hand
- Draw pile
- Discard pile
- Removed-from-game zone

---

## Standard Shared Deck Conservation

For standard legal-mode states:

The total number of player-card instances across all legal zones should equal:

```text
24 cards
```

Category totals should equal:

```text
18 Weapon cards
5 Action cards
1 Ultimate Weapon
```

This should include:

```text
player hands
+ Draw pile
+ discard pile
+ valid removed cards
```

During Sudden Death, the Ultimate Weapon may be in the removed-from-game zone.

It must still be accounted for.

Do not silently lose it.

For future explicitly supported rule variants, category totals may be supplied by the active ruleset instead of hard-coded globally.

---

## Monster Conservation

Every regular Monster should exist in exactly one legal location:

- Monster deck
- Face-up board
- Player 1 defeated pile
- Player 2 defeated pile

There are:

```text
17 regular Monsters
```

The dedicated Sudden Death Monster is separate and should not be counted among them.

---

## Monster Distribution Flexibility

Validation must **not** require:

```text
11 × 1-point
5 × 2-point
1 × 3-point
```

That is the current core-set inventory, not a standard-game invariant.

A legal alternate Monster mix is valid when:

- There are exactly 17 regular Monsters
- Each Monster definition is valid
- Every Monster exists in exactly one legal location
- Point values and requirements follow supported card definitions
- No Monster is duplicated illegally

---

## Monster Uniqueness

- No regular Monster ID may appear twice
- Sudden Death Monster may exist only in appropriate Sudden Death state
- Sudden Death Monster must never appear inside the regular Monster deck

---

## Turn Integrity

- `currentPlayerIndex` resolves to a real player
- Exactly one current player exists
- Only the current player can perform normal turn actions
- Turn handoff state should not expose an active playable hand
- A player may defeat no more than one Monster in a turn

---

## Action Phase Integrity

Track Action timing explicitly enough to validate it.

Valid behavior:

- Action Phase is open at the start of a normal turn
- Multiple Actions may resolve while it is open
- Newly received Actions may be played while it is open
- Action Phase closes when Weapon / Ultimate Weapon Monster-defeat play begins
- Action Phase never reopens during that same turn

Invalid behavior:

- Playing an Action after Monster-defeat play has begun
- Playing an Action during turn handoff
- Playing an Action for a non-current player
- Leaving unresolved forced discard and continuing Action play

---

## Phase Integrity

The current phase must agree with the surrounding state.

Examples:

### `action-phase`

- Active player exists
- Active player hand may be visible
- Action Phase is open
- No unresolved forced discard exists

### `forced-discard-after-action`

- Active player's hand exceeds current hand limit
- Required discard count is greater than zero
- A completed Action effect caused the temporary overage
- Normal actions are unavailable until discard resolves

### `forced-discard-before-skip`

- Player is resolving skip at hand limit
- Required discard selection is exactly one card

### `turn-handoff`

- Normal actions are unavailable
- No player's private hand should be considered revealed

### `sudden-death`

- Dedicated Sudden Death Monster is active
- Ultimate Weapon is removed from play
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

A player may temporarily have 6 cards after playing Draw 2 if the game phase is:

```ts
'forced-discard-after-action'
```

That is a legal transient state.

A player with 6 cards during normal Action Phase with no pending discard is not legal.

---

# 10. Action-Chain Preset

Create a deterministic helper:

```ts
buildActionChain(state)
```

Example setup:

- Current player has Draw 2
- Draw pile is arranged so Draw 2 yields Draw 1 plus another card
- Hand is within a legal starting size

Expected flow:

1. Player plays Draw 2.
2. Draw 2 resolves.
3. Newly drawn Draw 1 is in hand.
4. If forced discard is required, resolve it.
5. Action Phase remains open.
6. Draw 1 is legally playable.

This preset should test the generic Action system rather than special-case UI behavior.

---

# 11. Action-Timing Preset

Create a preset in which:

- Current player begins with a legal Action and the Weapons needed for a Monster
- Action Phase starts open
- Weapon play begins

Expected:

- Action is legal before Weapon play begins
- Action Phase closes when Weapon / Ultimate Weapon play begins
- The same Action becomes illegal afterward

This guards the "Actions before Weapons" rule.

---

# 12. Beatable-Monster Presets

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

# 13. Unbeatable-Monster Presets

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

# 14. Draw-Pile Recycle Presets

Support at least two presets.

## Recycle With Monster Rotation

Set up:

- Shared Draw pile empty or one draw away from empty
- Shared discard pile contains cards
- At least 4 undefeated regular Monsters remain
- 2 Monsters are currently face-up

Expected:

- Face-up Monsters rotate to bottom
- Replacement Monsters appear
- Discard pile becomes new shuffled Draw pile

## Recycle Without Monster Rotation

Set up:

- Shared Draw pile empty or one draw away from empty
- Shared discard pile contains cards
- Fewer than 4 undefeated Monsters remain

Expected:

- Face-up Monsters stay
- Discard pile becomes new shuffled Draw pile

---

# 15. Final-Three Preset

Create a deterministic helper:

```ts
forceFinalThree(state)
```

Expected result:

- Exactly 3 undefeated regular Monsters remain
- All 3 are face-up
- Monster deck contains no additional undefeated regular Monsters
- Defeated piles account for the other 14 regular Monsters

This state must pass Monster-conservation validation.

The preset should not depend on a particular point-value distribution.

---

# 16. Tie Preset

Create:

```ts
forceTie(state)
```

This should construct a valid end-of-regular-game state where:

- All regular Monsters are defeated
- Both players have equal highest scores
- Sudden Death has not yet started unless requested

For the current core set, a convenient tie is:

```text
12–12
```

However, the helper should derive a valid tie from the active Monster definitions where possible rather than assume every future 17-Monster mix totals 24 points.

Do not directly fake numeric score fields if score is derived from defeated Monsters.

---

# 17. Sudden Death Preset

Create:

```ts
prepareSuddenDeath(state)
```

Expected:

- Valid tied score condition
- Dedicated Sudden Death Monster active
- Ultimate Weapon removed from all playable zones
- Current hand limit = 4
- Players above 4 resolved or explicitly placed into required setup discard
- Normal Action Phase rules remain available

For the core set:

- Sudden Death Monster is The Infinity Beast
- Infinity Beast requires:
	- Gun / Rifle
	- Spear
	- Grenade
	- Sword

The helper should produce a state from which Sudden Death can be played normally.

---

# 18. Suggested Sandbox Presets

The UI can expose named presets:

```ts
export type SandboxPreset =
	| 'fresh-game'
	| 'hand-limit-skip'
	| 'draw-2-over-limit'
	| 'action-chain'
	| 'action-timing-lock'
	| 'ground-worm-beatable'
	| 'thing-beatable'
	| 'ultimate-weapon-ready'
	| 'black-hole-ready'
	| 'recycle-with-rotation'
	| 'recycle-without-rotation'
	| 'final-three'
	| 'alternate-monster-mix'
	| 'score-tie'
	| 'sudden-death'
	| 'infinity-beast-beatable';
```

These are much faster than repeatedly manipulating individual controls.

---

# 19. Testing Builders

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

Action presets should receive equivalent coverage.

---

# 20. Global Sandbox Test

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

# 21. Development Assertions

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

# 22. Persistence Validation

When restoring a saved game:

1. Parse stored JSON.
2. Check schema version.
3. Run any required migration.
4. Verify all referenced card and Monster definition IDs exist.
5. Run `validateGameState`.
6. Only resume if the result is safe.

If invalid:

- Preserve error detail for debugging
- Do not crash the app
- Offer starting a new game

This becomes important when future expansions add or remove available definitions.

---

# 23. Online Table Authority Value

This work protects both local development and the implemented authoritative Online Table path.

For Online Table commands, the trusted service:

1. Receive a `GameAction`
2. Validate that the player may perform it
3. Apply the game reducer
4. Run `validateGameState`
5. Transactionally save authoritative state
6. Publish revision-matched public and UID-private views

The same core validation code can therefore protect:

- local games
- tests
- saved games
- expansion content
- online multiplayer

---

# 24. Definition of Done

The sandbox/validation milestone is complete when:

- [ ] Legal and unsafe modes exist
- [ ] Core state builders are pure/testable
- [ ] Named presets cover important edge cases
- [ ] `validateGameState()` exists
- [ ] Card-instance uniqueness is validated
- [ ] Standard 18 / 5 / 1 player-card category totals are validated
- [ ] Total player-card conservation is validated
- [ ] 17-regular-Monster conservation is validated
- [ ] Monster point distribution is not incorrectly hard-coded
- [ ] Action Phase timing is validated
- [ ] Action chaining is validated
- [ ] Phase invariants are validated
- [ ] Hand-limit transient states are validated
- [ ] Every legal preset passes validation
- [ ] Tie preset creates a real score tie
- [ ] Sudden Death preset is legal
- [ ] Rules Sandbox UI uses builders instead of arbitrary mutation
- [ ] Saved-state restoration runs validation
- [ ] Development builds can surface invalid-state errors
