# Online Table implementation guide

The Online Table architecture now has two complementary layers:

- `src/game/network/` contains the provider-neutral authoritative gameplay proof: short codes, protocol types, seat-token authorization, the two-seat in-memory service, shared-engine action handling, validation, and private client views.
- `src/game/network/firebase/` plus `OnlineLobby.tsx` provide the deployed Firebase anonymous-identity and Firestore membership lobby: create, atomic join, realtime seat updates, and refresh restoration.

The lobby is functional across browsers, but actual online turns are deliberately not connected. Firestore clients cannot write `GameState`; private subdocuments are read-own/write-none. This prevents an interim client-authoritative design from weakening the existing engine and privacy boundaries.

See [Firebase Online Table lobby foundation](08-firebase-online-lobby.md) for the project audit, schema, identity lifecycle, rules, deployment, testing, and the next gameplay milestone.

## Non-negotiable gameplay boundary

The next transport accepts a versioned command containing a normal `GameAction`, never a client-supplied state. A trusted service must resolve the Firebase UID to a seat, enforce turn ownership, call `applyGameAction()`, run `validateGameState()`, and commit one new revision atomically. It then produces separate `createClientGameState()` results and sends each browser only its own view.

Never store a complete state or both hands in a document readable by both players. Never rely on React, CSS, or client filtering to protect an opponent's cards.

## Required completion tests

Before claiming online gameplay is complete, verify in two browsers:

- complete create/join/reload flows retain exactly two seats;
- accepted actions yield the same public revision for both clients;
- every player payload excludes every opponent-hand instance ID;
- simultaneous and stale actions cannot overwrite an accepted action;
- disconnect/reconnect resends the latest player-specific view;
- forced discard, Action chains, Black Hole, final three, scoring, and Sudden Death complete through the online authority;
- restart recovery and expired-Table cleanup follow a documented lifecycle.
