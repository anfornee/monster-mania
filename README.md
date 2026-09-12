# Monster Mania

Monster Mania is a two-participant digital card game built with Vite, React, TypeScript, and a deterministic rules engine. The engine is kept independent of React so the same legal actions and state transitions can power human input, the computer opponent, tests, saved games, and future Online Table play.

## MVP modes

- **Solo Game:** one local human against a computer-controlled opponent. This is the playable MVP path.
- **Online Table:** private two-player contracts plus an in-memory authoritative service skeleton. Live cross-browser play is not implemented yet.

Local pass-and-play is not part of the current MVP direction. The game still always has exactly two participants; controller type is a product/input concern rather than a different ruleset.

## Setup

Requirements: a current Node.js release supported by Vite and npm.

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
    network/        Online Table contracts, private views, and in-memory service
    sandbox/        deterministic rules scenarios
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
- [Visual design guide](docs/card-game-visual-design-guide.md)
- [Online Table implementation guide](docs/online-table-implementation-guide.md)

The permanent Rules Sandbox lives at `/dev/rules`. It includes deterministic legal presets, state validation status, interactive actions, and raw serialized state inspection.

## Current limitations

Online Table is intentionally only a service skeleton. `src/game/network/` can create and join two-seat Tables in memory, authenticate seat tokens, accept actions through the shared engine, and return a player-filtered view. The repository still has no HTTP/WebSocket listener, browser connection client, database, restart recovery, or production identity system, so two devices cannot play each other yet. The next steps are described in the [Online Table implementation guide](docs/online-table-implementation-guide.md) and [roadmap](docs/04-roadmap.md).

Most current card assets are complete, flattened JPGs. They are sufficient for the MVP, but they do not yet provide separate frame, illustration, text, and icon layers for fully data-driven card composition.
