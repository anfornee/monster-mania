# Monster Mania — MVP Development Plan

> **Goal:** deliver a trustworthy, playable Solo Game and a clearly bounded Online Table skeleton. Live network play follows after an authoritative backend is selected and implemented.

## Milestone 0 — Repository and architecture

Establish the shared contracts before building controllers or screens.

- Vite, React, TypeScript, ESLint, and Vitest
- authoritative rules and product documentation
- root `AGENTS.md`
- stable card and Monster definitions
- JSON-compatible `GameState`
- explicit `GameAction` union
- seedable random behavior
- clear boundaries for engine, selectors, AI, serialization, networking, and React
- production assets under `public/assets/`

Deliverable: the repository boots, card definitions load, and future modules have one documented architecture.

## Milestone 1 — Rules engine, validator, and tests

Complete the game without depending on the final board UI.

The engine must cover:

- standard 24-card player deck: 18 Weapons, 5 Actions, 1 Ultimate Weapon
- 17 regular Monsters plus a separate Sudden Death Monster
- starting hands and face-up Monsters
- generic Action effects and Action chaining
- Action timing lock after Monster-defeat play begins
- full draw before forced discard
- skip below and at the hand limit
- exact Weapon requirements and consumption
- one Monster maximum per turn
- generic Ultimate Weapon infrastructure and core Black Hole behavior
- replacement, final-three behavior, and Draw-deck recycling
- Monster rotation only when four or more undefeated regular Monsters remain
- derived scoring, normal victory, ties, and Sudden Death
- Infinity Beast victory

`validateGameState()` must detect duplicated, missing, unknown, or illegally located cards and Monsters; invalid phases, players, hand limits, and Sudden Death state; and violations of standard category totals. It must not enforce the current core point-value distribution.

Tests must also register a synthetic Action definition and a legal alternate 17-Monster distribution to prove the engine is data-driven.

Deliverable: a complete game can be driven through `GameAction`s in tests, and every accepted transition produces valid state.

## Milestone 2 — Rules Sandbox and card presentation

Create the permanent `/dev/rules` development screen using the real engine and pure preset builders.

Minimum presets:

- fresh game
- Draw 2 over the hand limit
- Action chain
- Action timing lock
- beatable and unbeatable Monster
- Black Hole ready
- Draw-deck recycle with and without Monster rotation
- final three
- score tie
- Sudden Death
- Infinity Beast beatable
- alternate legal Monster distribution

Legal presets must pass `validateGameState()` and have automated coverage.

Use the supplied complete-card images for `MonsterCard`, `WeaponCard`, `ActionCard`, `UltimateWeaponCard`, and `CardBack`. Preserve semantic labels and button behavior even when the card face is an image.

Current limitation: most card faces are flattened JPGs. Layered templates, separate illustration, and independently rendered card text are a later asset milestone.

Deliverable: developers can reproduce critical states quickly and inspect cards consistently.

## Milestone 3 — Playable Solo Game

Build the human-versus-computer mode on the shared engine.

### Computer controller

Keep the strategy in `src/game/ai/`, outside the engine. It returns a normal legal `GameAction` and does not mutate state.

Initial deterministic heuristic:

1. Play useful Draw Actions while the Action Phase remains open.
2. Re-evaluate after each Action so newly drawn Actions may chain.
3. Prefer the highest-point Monster that can be defeated normally.
4. Prefer normal Weapons to spending the Ultimate Weapon.
5. If no normal defeat is available, use the Ultimate Weapon on the highest-point eligible regular Monster.
6. Otherwise skip.

Automated tests must show that the strategy chooses legal actions, chains Actions, uses deterministic tie-breaking, defeats available targets, uses Black Hole only when appropriate, skips when required, and does not mutate its input.

### Game board

The playable board includes:

- Monster Mania branding
- current participant and turn status
- both scores
- face-up Monsters and remaining Monster count
- shared Draw-pile count
- human hand
- computer hand count/card backs, never its card faces
- defeated-Monster counts and inspectable piles
- contextual card and Monster actions
- Skip control
- forced-discard flow
- clear important messages
- Sudden Death presentation

React asks selectors/engine APIs what is legal and dispatches actions; it does not reimplement rules. Computer turns should advance clearly without long artificial delays.

### Solo save and resume

Save after accepted transitions with a schema version and timestamp. Restore only after definition lookup and state validation succeed. Starting a new game should not silently overwrite a resumable game.

Deliverable: a complete match, including a tie and Sudden Death, can be played against the computer and resumed after refresh.

## Milestone 4 — Online Table skeleton

Build the transport-independent product and service boundary before selecting infrastructure:

```text
[ Play Solo ]
[ Create Table ]

Join Table
[ _____ ] [ Join ]
```

Use **Table** in visible copy and types. The skeleton includes short-code validation, transport-neutral commands/events, a player-filtered state contract, and an in-memory authoritative service that owns two seats, authenticates opaque seat tokens, applies actions through the engine, validates resulting state, and returns only the requesting player's private hand. The UI may add create/join/waiting/error states against a replaceable Table client interface.

Do not:

- claim that the in-memory service is deployed or reachable by another browser
- simulate a remote opponent inside the online flow
- treat browser storage as authoritative multiplayer state
- send or expose both private hands
- bake a particular database or realtime vendor into engine types

Deliverable: service tests protect Table lifecycle, authority, and privacy; the UI and network seam make the next integration clear while plainly explaining that live Online Table play is not connected yet.

## Milestone 5 — Accessibility, responsive safety, and QA

- semantic buttons and keyboard-complete interaction
- visible focus and non-color state cues
- useful accessible card labels
- status announcements for draws, turns, discards, and results
- focus management for dialogs/trays
- readable contrast
- reduced-motion support
- desktop-first layout with safe narrow-screen behavior
- no avoidable console warnings or errors

Before MVP handoff:

1. Run `npm run test`.
2. Run `npm run lint`.
3. Run `npm run typecheck`.
4. Run `npm run build`.
5. Exercise every legal sandbox preset.
6. Play a complete Solo match.
7. Verify forced discard, Action chaining, Black Hole, final three, and Sudden Death.
8. Verify the computer hand is not exposed in normal Solo UI.
9. Verify Online Table copy accurately describes its disconnected status.

## MVP definition of done

- Solo Game is playable from start through normal victory or Sudden Death.
- Human and computer use the same deterministic engine.
- AI returns only legal actions through the standard action API.
- All rules and invariant tests pass, including expansion-regression cases.
- Local save/restore validates state.
- `/dev/rules` covers the documented edge cases.
- The Online Table skeleton has consistent terminology and a backend-ready privacy boundary.
- No UI claims that live online play exists.
- Accessibility requirements are met for the implemented flows.
- Tests, lint, type checking, and production build pass.

## After the MVP — functional Online Tables

Live two-browser play requires the next roadmap phase: an authoritative service, Table membership and seat identity, action validation, filtered player views, realtime synchronization, lifecycle cleanup, and reconnect behavior. Database/persistence technology should be selected at that point based on hosting, operational needs, and expected scale.
