# Monster Mania

Monster Mania is a two-participant digital card game built with Vite, React, TypeScript, and a deterministic rules engine. The engine is kept independent of React so the same legal actions and state transitions can power human input, the computer opponent, tests, saved games, and future Online Table play.

## MVP modes

- **Solo Game:** one local human against a computer-controlled opponent. This is the playable MVP path.
- **Online Table:** a Firebase-backed two-browser membership lobby plus the existing authoritative gameplay-service skeleton. Synchronized online turns are the next milestone.

Local pass-and-play is not part of the current MVP direction. The game still always has exactly two participants; controller type is a product/input concern rather than a different ruleset.

## Setup

Requirements: Node.js 22 (recorded in `.nvmrc`) and npm. JDK 21 or newer is also required for Firestore emulator tests.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Production assets are served from `public/assets/`.

## Commands

```bash
npm run dev         # start the Vite development server
npm run smoke       # dependency-free rules/integration smoke check
npm run test        # run the Vitest suite once
npm run test:firestore # run Firestore rules and concurrency tests in the emulator
npm run test:watch  # run Vitest in watch mode
npm run lint        # run ESLint
npm run typecheck   # run the TypeScript project build/check
npm run build       # type-check and create a production bundle
npm run preview     # preview the production bundle
```

## Project structure

```text
src/
  game/
    definitions/    card and Monster catalogs
    engine/         authoritative actions, transitions, and validation
    selectors/      derived legal moves and scores
    ai/             computer action selection (MVP milestone)
    serialization/  versioned local save/restore
    network/        Online Table contracts, private views, in-memory authority, and Firebase lobby
    sandbox/        deterministic rules scenarios
    assets/         visible-asset manifest, cache version, and preload system
  components/       presentation components (as the UI is built)
  App.tsx            application entry UI
public/assets/       browser-served game art
assets/cards/        source copies of complete-card assets
docs/                product, rules, testing, and visual guidance
```

The structure grows by milestone, so some destination directories may not exist yet. The important boundary is stable: UI, AI, and networking submit `GameAction`s; only the engine changes authoritative game state.

## Documentation

- [Project overview](docs/00-project-overview.md)
- [Rules source of truth](docs/01-rules-source-of-truth.md)
- [Development plan](docs/02-v1-development-plan.md)
- [Testing checklist](docs/03-testing-checklist.md)
- [Roadmap](docs/04-roadmap.md)
- [Rules sandbox and validation](docs/05-rules-sandbox-and-state-validation.md)
- [Tabletop UX and presentation](docs/06-tabletop-ux-and-presentation.md)
- [Asset loading and cache strategy](docs/07-asset-loading-and-cache-strategy.md)
- [Firebase deployment](docs/deployment.md)
- [Visual design guide](docs/card-game-visual-design-guide.md)
- [Online Table implementation guide](docs/online-table-implementation-guide.md)
- [Firebase Online Table lobby foundation](docs/08-firebase-online-lobby.md)

The permanent Rules Sandbox lives at `/dev/rules`. It includes deterministic legal presets, state validation status, interactive actions, and raw serialized state inspection.

Hunter's Training lives at `/tutorials`. Classic provides the first deterministic guided tutorial; Ritual and Chaos are cataloged as future modes without speculative gameplay.

## Current limitations

Online Table now has a Firebase Anonymous Auth identity abstraction and a Firestore-backed lobby that creates, joins, observes, and restores two-seat membership across browsers. `src/game/network/` also retains the in-memory authoritative gameplay proof, which accepts actions through the shared engine and returns player-filtered views. These layers are not wired into synchronized turns yet: there is no trusted deployed gameplay command handler, durable authoritative `GameState`, presence/expiration policy, or full-match integration test. The next steps are described in the [Online Table implementation guide](docs/online-table-implementation-guide.md) and [roadmap](docs/04-roadmap.md).

Most current card assets are complete, flattened JPGs. They are sufficient for the MVP, but they do not yet provide separate frame, illustration, text, and icon layers for fully data-driven card composition.
