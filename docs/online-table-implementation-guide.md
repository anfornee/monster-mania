# Online Table implementation guide

The Online Table architecture now has three complementary layers:

- `src/game/network/` contains the provider-neutral authoritative gameplay proof: short codes, protocol types, seat-token authorization, the two-seat in-memory service, shared-engine action handling, validation, and private client views.
- `src/game/network/firebase/` plus `OnlineLobby.tsx` provide Firebase anonymous identity, atomic membership, Callable Function commands, revision-matched public/private listeners, refresh restoration, and the existing board presentation.
- `functions/` provides the trusted Node 22 runtime: idempotent initialization, authenticated commands, shared-engine validation, transactional revisions, and separate public/private writes.

The authoritative path is implemented and verified locally with unit and Firestore emulator tests, including a complete deterministic match and coordinated rematch requests. It has not yet passed production deployment or a full live two-browser rematch flow. Firestore clients cannot write `GameState`; private subdocuments are read-own/write-none.

See [Firebase Online Table](08-firebase-online-lobby.md) for the schema, identity lifecycle, authority, privacy, revisions, presentation events, deployment, and testing.

## Non-negotiable gameplay boundary

The transport accepts a versioned command containing a normal `GameAction` without `playerId`, never client-supplied state. The callable resolves Firebase UID to a seat, enforces turn ownership, calls `applyGameAction()`, runs `validateGameState()`, and commits one new revision atomically. It writes public state to the Table, complete state to server-only authority storage, and each hand to its UID-keyed private document.

Never store a complete state or both hands in a document readable by both players. Never rely on React, CSS, or client filtering to protect an opponent's cards.

## Required completion tests

Before claiming online gameplay is production-ready, verify in two live browsers:

- complete create/join/reload flows retain exactly two seats;
- accepted actions yield the same public revision for both clients;
- every player payload excludes every opponent-hand instance ID;
- simultaneous and stale actions cannot overwrite an accepted action;
- disconnect/reconnect resends the latest player-specific view;
- forced discard, Action chains, Black Hole, final three, scoring, and Sudden Death complete through the online authority;
- refresh recovery retains the same authoritative match;
- both clients reach and agree on one valid final winner;
- both clients can request a rematch and observe one fresh authoritative match only after both consent.

Presence, expiration/cleanup, rate limiting, App Check enforcement, and cross-device account recovery remain later hardening work.
