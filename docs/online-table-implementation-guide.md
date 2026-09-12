# Online Table implementation guide

## Current status

The repository contains a dependency-free Online Table service boundary under
`src/game/network`. It is intentionally not a deployed multiplayer server yet.
It proves the important contracts before a transport, database, or hosting
provider is selected:

- `protocol.ts` defines transport-safe request, response, credential, and error
  shapes.
- `tableCode.ts` creates and validates five-character human-readable Table codes.
- `clientState.ts` turns authoritative `GameState` into a player-specific view.
- `tableService.ts` owns active Tables in memory and is the only layer allowed to
  call `createGame` and `applyGameAction` for an online match.

The service creates one waiting seat, starts a game when a second player joins,
and rejects a third player. A caller presents a Table code, player ID, and opaque
seat token on every resume, state-read, or action request. `submitAction` verifies
membership, verifies that the action's `playerId` is the authenticated player,
checks turn ownership when required, runs the shared engine, validates the result,
and only then commits it.

`ClientGameState` contains the viewer's hand and public data. It exposes the
opponent's hand count, but never the opponent's card instances. It also replaces
ordered draw, Monster-deck, discard, and removed-card zones with counts. A
transport must send this filtered view, never its internal `GameState`.

## What is deliberately missing

There is currently no HTTP/WebSocket listener, database, process-level
persistence, hosted server, browser connection client, presence tracking, or
Online Table UI. The in-memory map is erased whenever its process restarts and
cannot be shared by multiple server instances. The current methods are the seam
those pieces should call, not a simulation of a production network.

## Recommended first production slice

Use a small TypeScript Node server with Socket.IO or a WebSocket library. Socket.IO
is a practical first choice because reconnecting connections, acknowledgements,
and broadcasts are built in. Keep its internal "room" terminology inside the
adapter; all product text and public messages should say **Table**.

One possible dependency set is:

```sh
npm install socket.io socket.io-client
npm install --save-dev tsx @types/node
```

Plain WebSockets are also valid (`ws` plus `@types/ws`), but reconnection,
heartbeats, request acknowledgements, and fan-out must then be implemented in the
application. Do not add both stacks.

Run the server as a separate entry point, for example `server/index.ts`. The
transport handler should translate incoming payloads into the types in
`protocol.ts`, call one `InMemoryTableService` instance, and translate its result
back into an acknowledgement. Do not import networking libraries into the game
engine.

For every request:

1. Parse and runtime-validate the untrusted message. TypeScript types do not
   validate network input.
2. Find the authenticated seat from its credentials.
3. Call the corresponding Table service method.
4. Return a typed success or error acknowledgement.
5. After a valid action, obtain a fresh filtered state separately for each seat
   and broadcast only that seat's view to its authenticated connection(s).

Never accept a `GameState` from a client. A client only sends a `GameAction`.

## Identity and reconnect

The current seat token is a bearer credential generated with Web Crypto. Return it
only to the player who owns the seat. Store the credentials in browser session
storage for basic refresh recovery; use secure, HTTP-only cookies instead if the
final deployment uses same-origin HTTP endpoints. Never put a seat token in a URL,
log line, analytics event, visible error, or broadcast.

On connection:

1. The browser sends `RESUME_TABLE` with its saved credentials.
2. The server authenticates them through `getClientState`.
3. The transport associates the socket with that seat and sends the current
   player-specific snapshot.
4. A replacement socket should supersede or coexist with the old socket according
   to one documented policy; it must not add another seat.

Bearer seat tokens are enough for a private MVP but are not user accounts. Rotate
tokens when appropriate, compare secrets carefully, use TLS in production, rate
limit guesses, and expire abandoned Tables. If player accounts are added later,
bind each seat to a verified account or server session rather than trusting a
client-supplied player ID.

## Persistence boundary

Move the internal Table record behind a repository interface before introducing a
database. Persist at minimum:

- normalized Table code and lifecycle status;
- both player IDs, display names, and hashed seat-token verifiers;
- authoritative serialized `GameState` and its schema/ruleset version;
- a monotonic state revision;
- created, updated, and expiration timestamps.

Use compare-and-swap or a transaction on the revision when applying an action so
two concurrent requests cannot both commit from the same state. Restore through
`validateGameState`; quarantine or reject invalid records. Table codes need a
unique database constraint even though the service also checks for collisions.
Do not store raw seat tokens.

PostgreSQL/Supabase, Redis plus durable storage, or a durable-object style host can
all fit this boundary. Pick based on the deployment platform, expected scale, and
operational comfort rather than changing the engine for a provider.

## Hosting and scaling

The in-memory service requires one long-lived Node process. That can support an
early test deployment, but restarts lose matches and horizontal replicas would
diverge. Either keep one instance with documented downtime risk or add shared
persistence plus cross-instance pub/sub before scaling out. Configure the web
host to proxy secure WebSocket connections, set an explicit browser origin, and
keep server-only modules out of the Vite browser bundle.

Health checks should not expose Table data. Production logs may include a request
ID and redacted Table code, but not tokens, hands, or complete game state.

## State updates and ordering

Add a server-controlled revision number to transport envelopes. A successful
action should atomically produce revision `n + 1`, then send each player a
separately filtered snapshot carrying that revision. Clients ignore snapshots
older than the newest revision they have applied. Acknowledgements should include
the accepted revision so the initiating browser can reconcile pending UI.

Full filtered snapshots are preferable for the first release: the state is small
and snapshots make reconnect and error recovery simple. Deltas can be added later
if measurement shows they are needed. Never build one payload containing both
private views and rely on a socket broadcast filter to remove the wrong hand.

## Runtime validation and abuse controls

Add a small schema validator at the transport edge (for example Zod) only when the
transport is implemented. Validate discriminants, lengths, IDs, Table-code format,
and reject unknown/oversized payloads. Keep engine legality authoritative after
schema validation. Add per-IP creation/join limits and per-seat action limits;
record repeated invalid-token attempts without recording the attempted token.

The current `GameAction` contract contains `playerId`. That is redundant once a
request is authenticated, so the Table service explicitly requires it to match the
seat. Do not silently overwrite a spoofed ID. A future versioned wire protocol may
omit this field and add it server-side, but changing the shared engine action type
is not required for the first transport.

## Tests before release

Keep the existing focused service tests and add integration tests around the real
transport. At minimum verify:

- create, join, waiting state, full Table, malformed code, and missing Table;
- invalid token, player-ID spoof, out-of-turn action, and engine-illegal action;
- two Tables never share state or broadcasts;
- successful actions produce the same public revision for both players;
- each received payload lacks every opponent-hand instance ID;
- refresh/resume recovers the same seat without duplicating a player;
- simultaneous actions cannot overwrite one another;
- restart recovery and expired-Table behavior once persistence exists;
- malformed and oversized network payloads are rejected without crashing;
- disconnect/reconnect and stale/out-of-order snapshot behavior.

Also run the complete engine suite because the server deliberately uses the same
rules implementation as Solo play.

## Current limitations checklist

- No transport or browser connection layer.
- No database, restart recovery, cleanup, or Table expiration.
- No event subscription/broadcast API; transports currently poll
  `getClientState` after service calls.
- No state revision or concurrent-write protection.
- No account authentication; possession of a seat token grants access.
- No token hashing at rest because there is no persistence yet.
- No rate limiting, origin policy, TLS termination, or production monitoring.
- No player disconnect/presence model, rematch, spectator, or host controls.
- Input objects rely on trusted TypeScript callers until runtime schemas are added
  at the network boundary.

These are deployment tasks, not reasons to move rules or private-state filtering
into React.
