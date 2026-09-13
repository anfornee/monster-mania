# Firebase Online Table

## Scope and status

Monster Mania now has a locally implemented and emulator-verified authoritative Online Table path. Two anonymous Firebase users can create and join a Table, Cloud Functions initializes one match, and authenticated commands run through the existing deterministic engine inside Firestore transactions. The browser receives shared public state plus only its own private hand.

This implementation has not yet been deployed or completed as a full live two-browser match. Do not describe Online gameplay as production-ready until the IAM change, deployment, and live checklist in `deployment.md` succeed.

The Firebase project is `monster-mania-aea35`; its default Firestore database is Standard edition in `nam5`. Functions run in `us-central1`, an appropriate low-latency region for the multi-region database. Anonymous Authentication must remain enabled. Web SDK configuration is public client identification loaded from `VITE_FIREBASE_*` values or Firebase Hosting's `/__/firebase/init.json`; service-account credentials must never enter Vite variables or the repository.

## Runtime architecture

```text
GameBoard action
  -> FirestoreTableClient.submitAction()
  -> submitOnlineGameCommand callable (authenticated UID)
  -> Firestore transaction
  -> shared applyGameAction() + validateGameState()
  -> authoritative state + public view + two private views
  -> table and own-private listeners
  -> local presentation queue
```

`initializeOnlineGame` is an authenticated, idempotent callable fallback. `initializeGameWhenTableIsSeated` is a Firestore trigger that initializes when the guest claim changes a Table to `playing`. A transaction ensures racing trigger/callable/reconnect attempts create exactly one shuffled match. The server supplies the random seed; neither browser supplies decks, hands, starting player, seat, or resulting state.

`submitOnlineGameCommand` accepts this untrusted wire shape:

```ts
interface OnlineGameCommand {
	tableId: string
	commandId: string
	expectedRevision: number
	action: OnlineGameAction // GameAction without playerId
}
```

The function validates exact keys and action variants, requires Firebase Auth, resolves the UID against the Table seats, restores `playerId` server-side, checks match state, turn ownership, and revision, then invokes the normal engine. A legal command increments `revision` once; a rejection changes nothing. `commandId` is a UUID generated with `crypto.randomUUID()`. The most recent 64 accepted IDs remain in authoritative state, so an exact retry returns the committed revision without applying the action twice. Firestore transaction retries serialize concurrent commands; a different command based on the losing revision is stale.

Functions use 2nd gen Callable/Firestore APIs, Node 22, Admin SDK default credentials, `256MiB`, zero minimum instances, and a maximum of five instances. Solo remains local and continues through the same `GameAction` and engine path.

## Firestore schema

```text
tableCodes/{joinCode}
  schemaVersion, joinCode, tableId, status
  hostUid, guestUid, createdAt, updatedAt

tables/{tableId}
  lobby: schemaVersion, joinCode, status, host/guest UID and name, timestamps
  gameplay: revision, publicGameState, lastGameEvent

tables/{tableId}/authority/state
  schemaVersion: 1
  revision: number
  gameState: complete authoritative GameState
  processedCommands: last 64 { commandId, revision, actorUid }

tables/{tableId}/private/{participantUid}
  schemaVersion: 1
  revision: number
  playerId
  hand
  selectedCardInstanceIds
```

The Table document's `publicGameState` contains only public facts: players without hands, hand counts, public decks as counts, active turn/phase, current and defeated Monsters, discard information, scores/winner, and public engine events. `lastGameEvent` attaches one authoritative presentation fact to the revision, including the actor and any now-public played/discarded card definition IDs. Browsers animate those facts locally; animation timers are never synchronized.

The complete state is stored only under `authority/state`. Each client listens to the Table document and `private/{its own UID}` and publishes a combined snapshot only when both revisions match. It never reads the opponent's private document. Placeholder hidden cards used to render the opponent count contain no opponent instance or definition IDs.

## Identity, lobby, and reconnect

Firebase anonymous identity is created only during create, join, or restoration. Create atomically reserves a five-character code and Table. Join atomically claims the second seat and changes both records to `playing`; transaction retries guarantee only one simultaneous guest succeeds. Local storage holds only `{ tableId, joinCode }`, while Firebase Auth persists the browser-local UID.

On refresh, the same anonymous UID restores its seat, reattaches the two permitted listeners, and calls the idempotent initializer. Existing authoritative state is reused and never redealt. Anonymous identity has no cross-device recovery.

## Security boundary

Firestore Rules retain tightly scoped browser writes for Table creation and the one-time guest claim. They deny collection listing, arbitrary Table updates, deletion, all writes to private documents, and every read/write to `authority`. A participant can read only its own private document. Admin SDK writes from Functions bypass Rules and are the only authoritative gameplay writes.

A five-character invitation has limited entropy. Rate limiting, App Check enforcement, structured abuse monitoring, presence, expiration/cleanup, and cross-device accounts remain deferred hardening. These do not change the rule that the browser never submits replacement state or receives an opponent hand.

## Local verification

Use the pinned Node `22.23.2`, npm `10.9.8`, and JDK 21 or newer:

```bash
nvm install
nvm use
npm ci
npm ci --prefix functions
npm run test:functions
npm run test:firestore
```

`test:functions` verifies the provider-neutral authority and builds the Functions bundle. `test:firestore` starts the Auth, Firestore, and Functions emulators; it runs browser Rules tests, a real anonymous-auth/callable/two-client round trip, repository transaction/concurrency tests, initialization/reconnect tests, private-state checks, and a deterministic complete match. Set `VITE_USE_FIREBASE_EMULATORS=true` only when all three emulators are running for interactive browser testing.

Deploy Functions, Rules, and indexes together only after the deployment principal has the roles documented in `deployment.md`:

```bash
npx --no-install firebase deploy --only functions,firestore:rules,firestore:indexes --project monster-mania-aea35
```

## Production completion gate

After deployment, complete a real two-browser match and verify create/join, one-time initialization, private hands, bidirectional actions, reveal/discard/Monster presentation, active-match refresh, synchronized revisions, stale/duplicate safety, and agreement on the final winner. Until that succeeds, the repository implementation is emulator-verified but not production-verified.
