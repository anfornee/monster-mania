# Monster Mania contributor guide

Monster Mania is a two-participant card game being adapted to React and TypeScript. The MVP direction is a playable **Solo Game** (human versus computer) plus an **Online Table** product skeleton for a future two-browser match. "Table" is the product term; do not introduce "Room" in player-facing copy.

## Read first

1. `docs/01-rules-source-of-truth.md` — authoritative gameplay rules.
2. `docs/00-project-overview.md` — product scope and architecture.
3. `docs/02-v1-development-plan.md` — implementation order.
4. `docs/03-testing-checklist.md` and `docs/05-rules-sandbox-and-state-validation.md` — required coverage and invariants.
5. `docs/card-game-visual-design-guide.md` — presentation direction.
6. `docs/06-tabletop-ux-and-presentation.md` and `docs/07-asset-loading-and-cache-strategy.md` — board UI, boot flow, and cache-version conventions.

If code and the rules source of truth disagree, do not silently choose one. Treat the discrepancy as a gameplay change: update the engine, tests, and rule documentation together.

## Project map

- `src/game/definitions/` — card, Monster, catalog, and controller definitions.
- `src/game/engine/` — authoritative, deterministic state transitions and validation.
- `src/game/selectors/` — derived legal moves and display data.
- `src/game/ai/` — computer decision policy; it must return normal legal `GameAction`s and never mutate state directly.
- `src/game/serialization/` — versioned local save/restore.
- `src/game/presentation/` — presentation-only timing, profile, and event-derived helpers; never authoritative rules.
- `src/game/assets/` — authoritative visible-asset manifest, cache version, preload scheduler, and boot hook.
- `src/game/network/` — Online Table protocol, private player views, codes, and the in-memory authoritative service boundary. No HTTP/WebSocket adapter or durable storage exists yet.
- `src/game/sandbox/` — deterministic scenario builders; legal presets must pass state validation.
- `src/components/` and `src/App.tsx` — React presentation and action dispatch only.
- `public/assets/` — browser-served production assets.
- `public/assets/backgrounds/` — swappable tavern menu and tabletop environment art.
- `assets/cards/` — source copies of the currently available complete-card art.
- `docs/` — product, rules, testing, roadmap, and visual documentation.

Some listed directories are architectural destinations and may not exist until their milestone begins. Keep these concerns separate when adding them.

## Commands

```bash
npm install
npm run dev
npm run smoke
npm run test
npm run test:watch
npm run lint
npm run typecheck
npm run build
npm run preview
```

Run tests, lint, type checking, and a production build before handing off a meaningful change.

## Engineering rules

- Keep authoritative rules out of React components. React renders state and dispatches actions.
- Keep `GameState` plain and JSON-compatible: no functions, classes, DOM objects, browser APIs, or React values.
- Solo, AI, sandbox, persistence, and future Online Table play must use the same engine and `GameAction` path.
- Keep random behavior seedable. Prefer pure functions and deterministic tie-breaking.
- Use tabs for project-code indentation unless the surrounding file clearly establishes another convention.
- Preserve keyboard operation, semantic controls, visible focus, non-color state cues, useful labels/status announcements, dialog focus management, readable contrast, and reduced-motion support.
- Keep AI pacing one action at a time through `GameAction`; centralize durations in `src/game/presentation/aiPacing.ts` and ensure effects clean up timers.
- Reuse `CardInspector`, physical card stacks, seat patterns, and event announcements instead of creating card-type-specific modal or animation systems.
- Add preloaded standalone art to `src/game/assets/assetManifest.ts`; catalog card art is derived automatically. Bump `GAME_ASSET_VERSION` when replacing a public image at the same path.

## Cards, expansions, and rules changes

- Add cards through stable, data-driven definitions and generic categories/effects. Do not scatter card-name checks through the engine or UI.
- Standard format is 18 Weapons, 5 Actions, 1 Ultimate Weapon, 17 regular Monsters, and 1 separate Sudden Death Monster unless a documented variant says otherwise.
- Do not encode the current Monster point distribution as an invariant.
- When adding expansion content, validate the catalog and add regression tests proving setup, lifecycle, scoring, and effects work without changing core turn logic.
- Any gameplay behavior change requires an intentional edit to `docs/01-rules-source-of-truth.md` and matching tests.
- Update affected tests whenever engine rules, action timing, validation, AI decisions, state filtering, or serialization changes.

## Current constraints

The current card art is supplied mostly as flattened, complete-card JPGs. Use it for the MVP; do not claim the layered card-rendering system is complete. The Online Table domain service is an in-memory skeleton with seat tokens and private-state filtering; it is not cross-device play until a server transport, browser client, persistence/lifecycle policy, and integration tests are added.
