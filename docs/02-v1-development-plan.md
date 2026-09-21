# Monster Mania — MVP Development Plan

> **Status:** Historical implementation sequence plus delivered extensions. For current architecture and remaining production gates, use `00-project-overview.md`, `04-roadmap.md`, and `08-firebase-online-lobby.md`.
>
> **Original goal:** deliver a trustworthy, playable Solo Game and a clearly bounded Online Table skeleton. That baseline has since been extended with an authoritative Firebase gameplay path, centralized audio and settings, and Hunter's Training.

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

During Sudden Death forced-discard cleanup, preserve one copy of each weapon required by the active Sudden Death Monster and discard unrelated or duplicate cards first.

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

## Milestone 4 — Online Table foundation and authoritative extension

The original milestone built the transport-independent product and service boundary before selecting infrastructure:

```text
[ Play Solo ]
[ Create Table ]

Join Table
[ _____ ] [ Join ]
```

Use **Table** in visible copy and types. The foundation includes short-code validation, transport-neutral commands/events, a player-filtered state contract, and an in-memory authoritative service that owns two seats, authenticates opaque seat tokens, applies actions through the engine, validates resulting state, and returns only the requesting player's private hand.

The delivered Firebase extension now adds anonymous identity, private and public Tables, constrained discovery, atomic membership, trusted match initialization, revisioned Callable Function commands, synchronized public/private snapshots, rematches, and explicit leave cleanup. Complete `GameState` remains server-only, and each browser receives only its own private hand plus public information.

Continue to enforce these boundaries:

- simulate a remote opponent inside the online flow
- treat browser storage as authoritative multiplayer state
- send or expose both private hands
- bake a particular database or realtime vendor into engine types
- describe Online Table as production-ready before deployment and a complete live two-browser verification match

Deliverable: service, Functions, Rules, and emulator tests protect Table lifecycle, authority, concurrency, and privacy. The gameplay path is locally implemented and emulator-verified; production deployment and the live two-browser completion gate remain outstanding.

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

## Delivered extension — audio, settings, and Hunter's Training

- centralize music, ambience, and SFX through `AudioManager`
- derive gameplay cues from authoritative events without changing game rules
- persist master mute plus independent music, ambience, and SFX levels through versioned application settings
- keep long-form audio non-blocking and version all public audio URLs through `GAME_ASSET_VERSION`
- provide `/tutorials` as the permanent Hunter's Training hub
- run Classic Training as a deterministic guided match through `GameBoard` and ordinary `GameAction`s
- keep Ritual and Chaos as stable Coming Soon catalog entries until their rules exist
- persist informational completion independently by tutorial mode while keeping lesson state session-only

Deliverable: audio and tutorial presentation reuse the existing application, engine, assets, and settings lifecycles rather than introducing parallel rules or playback systems.

Before MVP handoff:

1. Run `npm run test`.
2. Run `npm run lint`.
3. Run `npm run typecheck`.
4. Run `npm run build`.
5. Exercise every legal sandbox preset.
6. Play a complete Solo match.
7. Verify forced discard, Action chaining, Black Hole, final three, and Sudden Death.
8. Verify the computer hand is not exposed in normal Solo UI.
9. Run `npm run test:functions` and `npm run test:firestore` when changing Online Table behavior.
10. Verify Online Table copy distinguishes emulator verification from the remaining production/two-browser gate.
11. Exercise Classic Training from entry through completion and replay.

## MVP definition of done

- Solo Game is playable from start through normal victory or Sudden Death.
- Human and computer use the same deterministic engine.
- AI returns only legal actions through the standard action API.
- All rules and invariant tests pass, including expansion-regression cases.
- Local save/restore validates state.
- `/dev/rules` covers the documented edge cases.
- Online Table has consistent terminology and an authoritative, privacy-preserving Firebase path.
- No UI claims that Online Table is production-ready before the live verification gate passes.
- Classic Training uses the shared engine and remains replayable after informational completion.
- Audio and application settings use centralized, versioned ownership.
- Accessibility requirements are met for the implemented flows.
- Tests, lint, type checking, and production build pass.

## Remaining Online Table completion and hardening

The authoritative Firebase path, Table membership, action validation, filtered player views, realtime synchronization, rematches, explicit cleanup, and same-browser-profile restoration are implemented and emulator-verified. Production readiness still requires deploying Functions, Rules, indexes, and Hosting, then completing the documented live two-browser full-match verification. Disconnect presence, abandoned-Table expiration, App Check enforcement, rate limiting, structured abuse monitoring, and cross-device recovery remain later hardening work.
