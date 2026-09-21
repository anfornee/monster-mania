# Monster Mania — Project Overview

> **Status:** Current source of truth for product and architecture direction
>
> **Stack:** Vite + React + TypeScript
>
> **MVP direction:** playable Solo Game plus an authoritative Firebase-backed Online Table
>
> **Later:** production hardening, presence/expiration, responsive polish, and expansion content

## 1. Product goal

Monster Mania is a digital adaptation of the original tabletop card game. It should preserve the established cards, rules, visual identity, and sense of discovery while keeping the implementation small enough to reason about.

The rules engine is the center of the application. It must be deterministic, testable without React, and data-driven enough that future cards can be introduced without rewriting the normal turn flow.

## 2. MVP scope

### Solo Game

The playable MVP mode has exactly two participants:

- one local human
- one computer-controlled opponent
- complete normal-game rules and Sudden Death
- the computer choosing only legal actions through the same engine API as a human
- hidden computer hand in the normal UI
- local, versioned save/resume

The first computer strategy can be simple and deterministic: play useful Draw Actions, prefer the highest-point normally beatable Monster, save the Ultimate Weapon when a normal defeat is available, use it on the highest-value eligible target otherwise, and skip when no defeat is available.

### Online Table

The MVP establishes an authoritative **Online Table**:

- create a private or publicly discoverable Firestore-backed Table after silently establishing anonymous identity
- display a short Table code for direct invitations
- list public waiting Tables so another hunter can join without entering a code
- transactionally join from another browser
- realtime waiting/membership states and browser-local refresh restoration
- transport-neutral request, response, and player-view types
- repository-managed 2nd gen Callable Functions on Node 22
- idempotent trusted match initialization after both seats fill
- transactionally revisioned `GameAction` commands through the shared engine
- server-only complete state, shared public state, and UID-keyed private views
- local presentation driven by authoritative per-revision events
- coordinated rematch request/acceptance plus explicit leave cleanup for both players

The gameplay path is locally implemented and emulator-verified through a complete deterministic match. It is not production-verified until Functions/Rules/indexes deploy and a complete live two-browser match succeeds. Explicit leave removes a Table and ejects the remaining player; disconnect detection, abandoned-session expiration, App Check, and cross-device recovery remain deferred. UI copy must say **Table**, never Room.

### Not in the current playable MVP

- local pass-and-play
- public production readiness for Online Tables before live verification/hardening
- accounts or cloud saves
- spectators
- sophisticated AI
- expansion-selection UI or custom deck building
- final animation and audio-content polish

## 3. Standard game format

The engine treats the standard format as category-based rather than hard-coding the current named cards.

```text
Shared player Draw deck
18 Weapon cards
5 Action cards
1 Ultimate Weapon card
= 24 player cards

Monster deck
17 regular Monster cards

Sudden Death
1 dedicated Sudden Death Monster
```

The core set currently fills those categories with three copies each of Bow, Grenade, Mace, Sword, Spear, and Gun; three Draw 1 cards; two Draw 2 cards; one Black Hole; 17 regular Monsters; and The Infinity Beast.

The exact number of 1-, 2-, and 3-point Monsters is not an engine invariant. A future legal set may use a different distribution while retaining 17 regular Monsters.

## 4. Architecture

```text
Solo UI / computer -------> GameAction ----------> deterministic engine
Firebase callable -------> Table transaction ---> deterministic engine
                                                    |    |       |
                                             definitions selectors validator
                                                    |
                                             serializable state
```

### Rules are separate from React

React renders a player-appropriate view of state and dispatches actions. Components do not decide whether an Action is playable, which Weapons defeat a Monster, how forced discard works, or when Sudden Death starts.

```ts
const result = applyGameAction(state, action, catalog)
```

### One engine for every controller

A participant and its controller are separate concepts. A local human, remote human, or computer submits the same `GameAction`; the engine enforces the same rules for all of them. AI strategy stays outside the engine and must never directly mutate `GameState`.

### Serializable state

`GameState` contains plain JSON-compatible values. This supports deterministic tests, local persistence, debugging, eventual authoritative multiplayer, reconnect, and possible replay tooling.

Do not store React elements, functions, class instances, DOM nodes, or browser-only objects in authoritative state.

### Explicit actions

All mutations enter through typed actions such as playing an Action card, defeating a Monster, using an Ultimate Weapon, resolving a discard, or skipping. Card effects are driven by definitions and generic categories rather than scattered card-name conditionals.

## 5. Current project boundaries

```text
src/game/definitions/    core catalog and stable definitions
src/game/engine/         game creation, action application, RNG, types, validation
src/game/selectors/      scores, legal moves, and derived view data
src/game/ai/             replaceable computer strategy (MVP milestone)
src/game/serialization/  schema-versioned local game storage
src/game/presentation/   player profile, UI timing, and event-derived announcements
src/game/assets/         asset manifest, cache versioning, and runtime preloading
src/game/audio/          centralized audio manifest, playback, and game-event mapping
src/game/settings/       versioned application settings and React provider
src/game/tutorials/      tutorial catalog, deterministic lessons, and completion persistence
src/game/network/        Online Table protocol, authority, private views, and Firebase client
functions/               Firebase trusted initialization and command transactions
src/game/sandbox/        deterministic scenario builders
src/components/          React presentation and action dispatch
public/assets/           browser-served card and branding assets
public/assets/backgrounds/ tavern menu and physical tabletop environments
assets/cards/            source copies of current complete-card art
docs/                    rules, implementation, testing, roadmap, and design guidance
```

Some destination directories are introduced by later milestones. Their responsibilities should remain separate when implemented.

## 6. Public and private information

Solo can keep both hands in one trusted local state, but the normal UI exposes only the human player's hand. The computer hand is represented by a count or card backs.

A real Online Table must be stricter. The authoritative service may hold the full state, but each client receives only its own hand plus public information and the opponent's hand count. Hiding an already-delivered opponent hand with CSS is not privacy.

Conceptually:

```ts
interface PlayerGameView {
	publicState: PublicGameState
	myHand: PlayerCardInstance[]
	opponentHandCount: number
}
```

## 7. Persistence

Solo save/resume uses `localStorage`, a schema version, stable definition IDs, and state validation during restore. Incompatible or invalid saves fail safely rather than crashing or entering an impossible game state.

Online Table membership and gameplay snapshots are stored in Firestore, while `localStorage` retains only a Table reference and Firebase Auth persists the browser-local anonymous UID. Complete authoritative state is server-only; shared and UID-private documents use matching revisions so a reconnect can rebuild only that player's permitted view.

## 8. Assets

The available MVP art under `public/assets/cards/` is primarily flattened, complete-card JPGs, plus a PNG card back and logo. The current catalog points directly at those files.

This is a real limitation: the app cannot independently update embedded card names, rules text, frame details, point medallions, or requirement icons inside those JPGs. Use the complete cards for the MVP. A later asset pass can export separate frames, artwork, icons, and typography for fully data-driven card composition; do not claim that layered rendering is already available.

## 9. Tutorials

`/tutorials` is the permanent player-facing home for Hunter's Training. It uses the application's existing pathname navigation, remains replayable after completion, and keeps completion informational and independent for each stable gameplay-mode ID.

Classic is the first available tutorial and runs at `/tutorials/classic` as a deterministic guided match through the shared engine and ordinary `GameAction`s. Its initial lesson sequence covers Action chaining, forced-discard selection and confirmation, normal Weapon requirements, and ending a turn when the player cannot or chooses not to defeat a Monster. Ending that turn draws the Black Hole Ultimate Weapon, which supplies the tutorial's final lesson. Ritual and Chaos remain unavailable catalog entries until their rules are designed; their tutorial entries must not invent gameplay or launch incomplete sessions. The Tutorials hub remains in the menu audio scene, while an active guided match uses the centralized gameplay audio lifecycle.

## 10. Rules Sandbox

`/dev/rules` is the permanent development utility for deterministic edge cases. Its legal presets are built through testable helpers and pass `validateGameState()`. See `05-rules-sandbox-and-state-validation.md` for the preset and validation contract.

The sandbox is development tooling, not a second rules implementation.

## 11. Accessibility and presentation

The board must provide keyboard-operable semantic controls, visible focus, useful labels, non-color interaction states, appropriate status announcements, readable contrast, dialog focus management, and reduced-motion behavior. Online connection/waiting errors and unavailable actions should be explained in text.

Desktop remains the first presentation target, with responsive safety rather than a separate mobile rules flow.

The shared board uses controller-neutral player seats for Solo, Online Table, and Classic Training. Card inspection, paced one-action computer decisions, and event announcements are presentation concerns layered on top of immediate deterministic state transitions. See `06-tabletop-ux-and-presentation.md`.

## 12. Development principles

- Prefer pure rules functions, explicit transitions, stable IDs, and small focused modules.
- Keep definitions, rules, selectors, AI, persistence, networking, and React presentation separate.
- Validate state after actions in tests and development paths.
- Test behavior and invariants rather than only rendered output.
- Add cards through definitions and generic effects.
- Keep the shared Online Table authority provider-neutral; Firebase-specific calls stay in the adapter and Functions repository.
- Do not label online play complete until two clients can use an authoritative service without receiving each other's private hands.
