# Monster Mania — Product Roadmap

> This is directional, not a promise of dates. The current priority is a complete Solo Game and authoritative online gameplay on top of the verified Firebase Table lobby.

## Phase 1 — Rules foundation

- deterministic, React-independent engine
- data-driven card and Monster definitions
- generic Action and Ultimate Weapon effects
- seedable setup and shuffling
- explicit actions and JSON-compatible state
- central state validator
- unit tests for complete normal play and Sudden Death
- expansion-regression fixtures
- permanent Rules Sandbox

The standard format remains 18 Weapons, 5 Actions, 1 Ultimate Weapon, 17 regular Monsters, and 1 separate Sudden Death Monster. The engine must not assume the core set's point-value distribution.

## Phase 2 — Playable Solo Game

Primary playable MVP target:

- one human and one computer participant
- shared rules and action pipeline
- deterministic, replaceable computer strategy
- complete board and contextual controls
- hidden computer hand
- forced discard, deck recycling, final three, scoring, and Sudden Death
- defeated-Monster inspection
- local save/resume with validation
- desktop-first presentation with responsive safety
- keyboard and screen-reader-friendly interaction

The computer controller chooses actions; it never changes state directly or owns a separate version of the rules.

## Phase 3 — Online Table foundation

Establish the product and integration seam without pretending that live multiplayer exists:

- **Create Table** entry point
- **Join Table** form and normalized short-code input
- waiting, disconnected, unavailable, and error states
- transport-neutral Table commands and events
- player-filtered state/view contract
- in-memory authoritative service with two seats and opaque seat tokens
- server-side membership, turn, action, result-state, and privacy checks
- replaceable Table client interface
- documentation for backend implementation
- Firebase Anonymous Auth identity created only on create/join/restore
- Firestore-backed two-seat membership with atomic guest claiming
- realtime lobby updates and browser-local refresh restoration
- deny-by-default Firestore rules and emulator coverage

This phase provides the cross-browser membership lobby. Firestore clients cannot write game state.

## Phase 4 — Functional Online Tables

Goal: two people play from separate browsers/devices in a private Table using the same game engine as Solo.

### Transport adapter around the authoritative service

The Table service owns complete `GameState`. The implemented Firebase transport lets clients submit a `GameAction`, never modified state.

For each request, the service:

1. authenticates or resolves a seat token
2. confirms the participant belongs to the Table
3. verifies turn ownership when required
4. applies the action through the shared rules engine
5. validates the resulting state
6. commits the accepted state once
7. produces a separately filtered view for each participant
8. broadcasts the appropriate update

### Table lifecycle

- build gameplay sessions on the existing private two-seat Firestore Table
- retain the collision-checked code and atomic second-seat claim
- preserve third-participant rejection
- start authoritative game state only when both seats are present
- define expiration and cleanup behavior
- maintain an opaque seat/session token separate from the public Table code

### Privacy boundary

The service can store the full state, but each response includes only:

```ts
interface PlayerGameView {
	publicState: PublicGameState
	myHand: PlayerCardInstance[]
	opponentHandCount: number
}
```

The exact type may evolve. The invariant may not: one browser must never receive the other participant's hand identities.

### Transport and storage decision

Firebase Anonymous Auth, Firestore, and 2nd gen Callable Functions are selected. Functions reuse the shared engine and transactionally persist one authoritative revision plus separately filtered public/private snapshots without granting browsers authority to write complete state.

The implementation is locally/emulator verified. Production deployment and a complete live two-browser match remain the completion gate. Continue evaluating operational changes against:

- deployment and hosting fit
- atomic action updates/concurrency control
- realtime fan-out
- Table expiration
- authentication or anonymous seat tokens
- reconnect requirements
- cost and expected scale
- ability to share engine code safely

Do not let a provider's internal term "room" leak into product copy; players join a Table.

### Reconnect and ordering

- reconnect with the same opaque seat token where possible
- resend the latest filtered view after reconnect
- include a monotonic revision/action number
- reject or safely retry stale/duplicate actions
- show opponent disconnect state without leaking private information

### Required service tests

- create and join
- third participant rejected
- invalid/expired code rejected
- non-member action rejected
- out-of-turn and illegal action rejected
- separate Tables isolated
- accepted action synchronized
- simultaneous action conflict handled once
- reconnect restores the same seat
- opponent hand absent from all client payloads

Online play is complete only after a full two-browser match, forced discard, Action chain, Black Hole, final three, and Sudden Death have been exercised against the authoritative service.

## Phase 5 — Online match quality

- durable Table persistence where needed
- clearer reconnect and abandonment handling
- host controls and abandonment handling
- rate limiting and basic abuse protection
- structured operational logging
- protocol and state migrations
- deployment health checks and monitoring

## Phase 6 — Layered card assets and responsive polish

The current MVP uses flattened complete-card JPGs. To make visual card content fully data-driven, export and integrate separate:

- frames/templates
- Monster and item artwork
- requirement icons
- names, type labels, lore/rules text, and point medallions

Then add richer responsive layouts, touch-friendly hand handling, card inspection, portrait/landscape refinement, and optional PWA support without changing the rules engine.

## Phase 7 — Expansion packs and setup

- additional Monster, Action, Weapon, Ultimate Weapon, and Sudden Death definitions
- content-pack selection
- curated mixes that satisfy standard category totals
- validation for explicitly documented variants
- synthetic and real expansion regression tests

Avoid a collectible deck-builder until the product actually needs one.

## Optional later work

- improved AI strategies
- spectator mode
- public matchmaking
- alternate rule variants
- match history and player profiles
- achievements/statistics
- full sound and music
- richer card/Monster animation
- custom card backs and seasonal content

## Guiding rule

Protect the Solo game while finishing Online Table production verification. Keep multiplayer behind the authoritative, privacy-preserving service that reuses the tested engine.
