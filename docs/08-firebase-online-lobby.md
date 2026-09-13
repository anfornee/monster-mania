# Firebase Online Table lobby foundation

## Scope and status

Firebase now provides the first cross-browser Online Table slice: a player can create a two-seat Table, share a five-character code, and a second browser can transactionally claim the guest seat. Both participants subscribe to the same lobby document. This milestone stops at synchronized membership; Firestore does not yet store authoritative `GameState` or accept gameplay actions.

The Firebase project is `monster-mania-aea35`. The checked-in Web client uses public `VITE_FIREBASE_*` configuration or Firebase Hosting's `/__/firebase/init.json` fallback. Service-account JSON and other server credentials must never be placed in Vite variables or committed.

The live infrastructure audit on September 12, 2026 found:

- Firebase Hosting was already configured through `.firebaserc`, `firebase.json`, and the two Hosting workflows.
- the default Firestore database is Standard edition in `nam5` according to the Firebase CLI. This differs from the originally reported `nam7`; code does not assume either location.
- Anonymous Authentication is enabled in the Firebase Console.
- two Web app registrations currently exist. The intended local configuration uses app ID `1:223677909735:web:362053a03f407b1f4f3042`; an extra `Monster Mania Web` registration was created during setup. Both target the same Firebase project. Do not delete either registration without first confirming it is unused.

## Existing architecture retained

`src/game/network` already contained the transport-neutral protocol, secure short-code generation, an in-memory two-seat authoritative service, and `createClientGameState()`, which removes the opponent's hand and ordered private deck data. The service applies ordinary `GameAction`s with `applyGameAction()` and validates the resulting state. That remains the design for full online gameplay.

The Firebase browser client under `src/game/network/firebase` is a separate lobby adapter. It reuses the Table code format and shared `waiting | playing | finished` lifecycle vocabulary, but it does not replace the authoritative in-memory gameplay proof or duplicate game rules in React.

## Anonymous multiplayer identity

`ensureMultiplayerIdentity()` is the only UI-facing identity entry point. It waits for Firebase Auth to restore its persistent browser state, returns the existing anonymous UID when present, and calls `signInAnonymously()` only when no UID exists.

The app does not initialize Firebase or create an anonymous user on an ordinary site visit. Identity is requested only when the player creates or joins a Table, or when a locally stored Table reference needs to be restored. There is no login screen, account language, cross-device recovery, or user-managed credential.

Firebase Auth provider enablement is not represented by a supported `firebase.json` property. Firebase CLI 15.30.0 exposes Auth user import/export but not Identity Platform provider configuration. Anonymous provider enablement therefore remains a one-time Console setting and was confirmed enabled for this project; rules and indexes remain repository-managed.

## Firestore schema

```text
tableCodes/{joinCode}
  schemaVersion: 1
  joinCode: string
  tableId: string
  status: waiting | playing | finished
  hostUid: string
  guestUid: string | null
  createdAt: server timestamp
  updatedAt: server timestamp

tables/{generatedTableId}
  schemaVersion: 1
  joinCode: string
  status: waiting | playing | finished
  hostUid: string
  hostName: string
  guestUid: string | null
  guestName: string | null
  createdAt: server timestamp
  updatedAt: server timestamp

tables/{generatedTableId}/private/{uid}
  reserved for that participant's private game view/state
```

The generated Table document ID is the durable internal identifier. The join code is only an exact-lookup invitation and is not an authentication credential. No composite indexes are required for this schema because collection listing and join-code queries are intentionally absent.

## Create and join lifecycle

Create runs one Firestore transaction that verifies a candidate code is unused and creates matching `tables` and `tableCodes` documents. Firestore rules verify both post-transaction documents, ownership, schema, status, and server timestamps.

Join runs one transaction that:

1. reads the exact code document;
2. rejects a missing, finished, or full Table;
3. recognizes the same host/guest UID as a reconnect instead of consuming another seat;
4. reads the generated Table document;
5. assigns the requesting UID and display name as guest in both documents; and
6. changes both statuses from `waiting` to `playing`.

Firestore transaction retries make the empty guest seat a compare-and-swap boundary. If two browsers race for it, only one commit can preserve the required before-state; the other receives `TABLE_FULL`.

After create/join, the browser stores only `{ tableId, joinCode }` in local storage. Firebase Auth independently persists the anonymous UID. On refresh, the lobby restores Auth first, reads the Table as that UID, verifies that UID still owns host or guest, and reattaches its realtime listener. Local storage is a navigation hint, never authority.

## Security boundary

`firestore.rules` enforces the lobby schema and denies everything not explicitly allowed:

- unauthenticated reads and writes are denied;
- collection listing is denied, including listing or searching codes;
- a signed-in user with an exact code may read a waiting Table in order to join;
- after the guest seat is filled, only host and guest may read the Table;
- creation and guest claiming must update the paired Table/code documents atomically;
- a guest claim may change only status, guest identity/name, and update time;
- arbitrary client updates and deletes are denied;
- a participant may read only `private/{theirUid}` and all private writes are denied for now;
- every other document path is denied.

A five-character code has limited entropy and should be rate-limited before a broad public launch. An authenticated exact-code lookup exposes the minimal mapping/status record and pseudonymous seat UIDs so the client can distinguish missing, finished, and full Tables; it never exposes hands or gameplay secrets. A waiting Table also exposes its host display name to a joiner who knows the code. Full gameplay must preserve `createClientGameState()`'s privacy guarantees and introduce a trusted action authority (for example Cloud Functions/Run or another server) rather than permitting clients to write complete game state.

App Check enforcement is intentionally deferred until the lobby and later gameplay transport are verified. Enabling enforcement now would turn missing attestation configuration into a production outage rather than improving this milestone's authorization model.

## Local development and verification

Use Node 22 (`nvm install && nvm use`) and JDK 21 or newer. The Hosting workflows install both versions explicitly.

```bash
cp .env.example .env.local
npm install
npm run test:firestore
```

Set `VITE_USE_FIREBASE_EMULATORS=true` only while both Auth and Firestore emulators are running. The standalone rules suite starts Firestore itself. The production Web configuration is public Firebase client identification; keep the real local values in ignored `.env.local`, while deployed Firebase Hosting can supply `/__/firebase/init.json`.

Deploy repository-managed Firestore infrastructure with:

```bash
npx firebase-tools deploy --only firestore:rules,firestore:indexes --project monster-mania-aea35
```

Anonymous Authentication must remain enabled in Firebase Console under Authentication > Sign-in method. There is no additional CLI Auth-provider deploy command in the pinned tool version.

## Next milestone: authoritative gameplay synchronization

Add a trusted, versioned command handler around the existing engine and filtered-state boundary. It should authenticate Firebase ID tokens, map UID to a Table seat, accept only `GameAction`, transactionally apply one action to a monotonic revision, validate the state, store private hands separately, and publish a distinct filtered snapshot to each participant. Define expiration/cleanup, disconnect presence, stale-action handling, idempotency, and emulator/integration coverage before calling Online Table gameplay complete.
