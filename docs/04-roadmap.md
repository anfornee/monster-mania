# Monster Mania — Product Roadmap

> This is directional, not a promise of dates.

---

# Phase 1 — Local Desktop V1

Primary target.

- 2-player local pass-and-play
- Desktop-first
- Complete rules
- Physical-card visual identity
- Private hand handoff
- Save/resume
- Defeated Monster piles
- Rules sandbox
- Sudden Death
- Basic audio hooks

---

# Phase 2 — Mobile / Responsive Layout

Once desktop gameplay is stable:

- Responsive board
- Touch-friendly hand
- Card inspection
- Horizontal hand scrolling/fanning
- Portrait and landscape consideration
- Better turn handoff on phones/tablets
- PWA exploration

Do not change core rules engine for mobile.

This should be primarily a presentation milestone.

---

# Phase 3 — Custom Online Lobbies

Goal:

Allow 2 players on separate devices to create and join private games.

Example:

```text
Monster Mania

[ Create Game ]

Join Game
[ M 7 K 4 Q 2 ]

[ Join ]
```

## Basic Lobby Features

- Create lobby
- Short join code
- Enter player name
- Second player joins
- Host starts match
- Two-player maximum
- Private lobby only
- No public matchmaking required

---

## Recommended Architecture

By this point, move authoritative `GameState` to a backend/server.

Clients send:

```ts
GameAction
```

Server:

1. validates player identity
2. validates action
3. runs the same game rules engine
4. updates state
5. broadcasts filtered state

The game rules package should ideally remain shared between client and server.

---

## Privacy

Server should not send both hands to both clients.

Possible shape:

```ts
interface ClientGameState {
	publicState: PublicGameState;
	myHand: PlayerCardInstance[];
}
```

The opponent hand can be represented by:

```ts
opponentHandCount: number;
```

---

# Phase 4 — Online Match Quality

After basic lobbies work:

- Reconnect after refresh/network loss
- Resume abandoned connection
- Host controls
- Rematch button
- Lobby expiration
- Clear disconnect status
- Game-state versioning
- Better server validation
- Rate limiting / basic abuse protection

---

# Phase 5 — Optional Expansion Features

Only build if they sound fun.

Possible:

- AI opponent
- Spectator mode
- Alternate rule variants
- Additional Monster packs
- Additional Weapons
- Custom card backs
- Match history
- Player profiles
- Achievement-like stats
- Full sound effects
- Music
- Animated cards
- Public matchmaking
- Seasonal content

---

# Multiplayer Technology Notes

Do not choose a multiplayer backend during local v1 unless needed.

Reasonable future categories include:

- Firebase / Firestore
- Supabase Realtime
- WebSocket server
- Socket.IO
- Serverless durable-room platform

The exact choice should be made when Phase 3 starts based on:

- hosting preference
- expected scale
- cost
- authentication needs
- reconnect requirements
- deployment comfort

The current rules/action architecture should keep this decision flexible.

---

# Guiding Rule

The roadmap should never make local v1 harder than it needs to be.

Build the good local game first.

Then make the same game available across two devices.
