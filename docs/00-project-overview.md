# Monster Mania — Project Overview

> **Status:** Current source of truth for implementation direction  
> **Stack:** Vite + React + TypeScript  
> **Initial target:** 2-player local pass-and-play, desktop-first  
> **Later:** Mobile layout, custom online lobbies, reconnect/resume, rematch flow

---

## 1. Product Goal

Monster Mania is a digital adaptation of the original tabletop card game.

The first release should feel like the physical game brought directly into the browser:

- Same card art direction
- Same card frames
- Same weapon icons
- Same rules
- Same sense of discovery and tabletop play

The first version should be intentionally small, polished, and easy to reason about.

---

## 2. V1 Scope

### Included

- 2 players
- One device
- Local pass-and-play
- Desktop-first layout
- Private hands through turn handoff screens
- Complete normal-game rules
- Draw 1 / Draw 2 cards
- Black Hole
- Monster rotation when the draw deck recycles
- Final-three-monster behavior
- Scoring
- Sudden Death
- The Infinity Beast
- Defeated-monster piles
- Game event log
- Local game persistence
- Basic audio architecture/hooks

### Not Included in V1

- Online multiplayer
- Public matchmaking
- AI opponents
- Accounts
- Cloud saves
- Mobile-first layout
- Spectators
- Card collection / progression system
- Full sound design
- Animated monster characters

---

## 3. Core Technical Principles

### Rules are separate from React

React should render game state and dispatch actions.

React components should **not** contain authoritative game rules.

Prefer:

```ts
const nextState = applyGameAction(state, action);
```

instead of embedding rule logic inside button handlers.

---

### Game state must be serializable

`GameState` should contain plain JSON-compatible values.

This enables:

- localStorage persistence
- deterministic tests
- replay/debug tools
- future server-authoritative multiplayer
- reconnect/resume later

Avoid storing:

- DOM nodes
- React elements
- class instances
- functions
- browser-only objects

inside game state.

---

### Think in terms of actions

The game engine should accept explicit player/system actions.

Example:

```ts
export type GameAction =
	| { type: 'START_GAME'; startingPlayerId?: string }
	| { type: 'REVEAL_HAND'; playerId: string }
	| { type: 'PLAY_DRAW_CARD'; playerId: string; cardInstanceId: string }
	| { type: 'DEFEAT_MONSTER'; playerId: string; monsterId: string }
	| { type: 'USE_BLACK_HOLE'; playerId: string; monsterId: string }
	| { type: 'SELECT_DISCARD'; playerId: string; cardInstanceId: string }
	| { type: 'CONFIRM_DISCARD'; playerId: string }
	| { type: 'SKIP_TURN'; playerId: string }
	| { type: 'ADVANCE_TURN' };
```

This action-based structure is intentionally compatible with future network play.

---

## 4. Public vs Private State

Even in local play, treat player hands as conceptually private.

### Public State

Examples:

- Current player
- Face-up monsters
- Monster deck count
- Draw pile count
- Scores
- Defeated-monster pile counts
- Current phase
- Event log
- Winner

### Private State

Examples:

- Player 1 hand
- Player 2 hand

For local play, the browser holds all state.

For future online multiplayer, the server can filter what each player is allowed to receive.

Design components so they do not casually depend on another player's hand.

---

## 5. Pass-and-Play Experience

At the end of Player 1's turn:

1. Hide Player 1's hand.
2. Show a handoff screen.
3. Prompt Player 2 to take control of the device.
4. Player 2 clicks **Reveal Hand**.
5. Player 2's hand becomes visible.
6. Play continues.

Example:

```text
Player 2's Turn

Make sure Player 2 is ready before revealing their hand.

[ Reveal Hand ]
```

This keeps private information private while preserving a tabletop feel.

---

## 6. Asset Strategy

Final cards should **not** be flattened into one image.

The app should compose cards from:

- Card template
- Monster/weapon artwork
- Weapon icons
- Card name
- Point value
- Type label
- Lore text

This is a locked production decision.

### Required assets

```text
src/assets/
	cards/
		templates/
			monster-card-template.png
			weapon-card-template.png
			card-back.png

		monsters/
			socket.png
			top.png
			bitty-bitey.png
			...

		weapons/
			bow-icon.png
			grenade-icon.png
			mace-icon.png
			sword-icon.png
			spear-icon.png
			gun-icon.png
			blackhole-icon.png

	branding/
		monster-mania-logo.png
```

Monster artwork should ideally be exported without:

- frame
- text
- point medallion
- lore
- weapon requirement icons

---

## 7. Recommended Project Structure

```text
src/
	assets/

	components/
		cards/
			MonsterCard.tsx
			WeaponCard.tsx
			CardBack.tsx
			WeaponIcon.tsx

		game/
			GameBoard.tsx
			MonsterRow.tsx
			PlayerArea.tsx
			PlayerHand.tsx
			DefeatedPile.tsx
			TurnHandoff.tsx
			TurnControls.tsx
			DiscardFlow.tsx
			EventLog.tsx
			SuddenDeathBanner.tsx

	data/
		monsters.ts
		playerCards.ts
		weapons.ts

	game/
		actions.ts
		createGame.ts
		reducer.ts
		rules.ts
		selectors.ts
		serialization.ts
		types.ts

	dev/
		RulesSandbox.tsx

	styles/
		tokens.css
		globals.css

	App.tsx
	main.tsx
```

---

## 8. State Management

Do not add a large state-management dependency until it is useful.

Recommended progression:

### Initial

- `useReducer`
- Pure game reducer
- React context if needed

### Later

If UI complexity grows:

- Zustand is a reasonable lightweight choice.

The important requirement is that the **game reducer remains independent** of whichever state library hosts it.

---

## 9. Persistence

For local v1:

- Save active game state to `localStorage`
- Restore after refresh
- Include a schema version

Example:

```ts
interface StoredGame {
	version: 1;
	state: GameState;
	savedAt: string;
}
```

Do not silently load incompatible future versions.

---

## 10. Game Event Log

Keep a small structured event history.

Examples:

```ts
type GameEvent =
	| { type: 'TURN_STARTED'; playerId: string }
	| { type: 'CARD_DRAWN'; playerId: string; count: number }
	| { type: 'MONSTER_DEFEATED'; playerId: string; monsterId: string }
	| { type: 'PLAYER_SKIPPED'; playerId: string }
	| { type: 'DRAW_DECK_RECYCLED' }
	| { type: 'MONSTERS_ROTATED' }
	| { type: 'SUDDEN_DEATH_STARTED' };
```

This is useful for:

- player clarity
- debugging
- automated tests
- possible future replays

---

## 11. Audio Architecture

Sound is not a v1 priority, but add a small abstraction so effects can be added later.

Example:

```ts
export type SoundId =
	| 'card-draw'
	| 'monster-defeat'
	| 'black-hole'
	| 'turn-change'
	| 'sudden-death';

export interface AudioService {
	play(sound: SoundId): void;
	setMuted(muted: boolean): void;
}
```

The default implementation can initially do nothing.

---

## 12. Desktop Layout Direction

Rough hierarchy:

```text
┌────────────────────────────────────────────────────┐
│ Monster Mania              P1: 3 pts   P2: 2 pts  │
├────────────────────────────────────────────────────┤
│                                                    │
│         [ MONSTER ]       [ MONSTER ]              │
│                                                    │
│             Monster deck: 11                       │
├────────────────────────────────────────────────────┤
│ Player 1                                           │
│ [card] [card] [card] [card] [card]                │
│                                                    │
│                     [ Skip Turn ]                   │
├────────────────────────────────────────────────────┤
│ Draw: 9   Discard: 10   Turn 7   Event log         │
└────────────────────────────────────────────────────┘
```

Priority:

1. Face-up monsters
2. Current player's hand
3. Scores / turn
4. Contextual actions
5. Deck counts / logs / secondary information

---

## 13. Defeated Monster Piles

Defeated monsters should not remain permanently spread across the board.

Each player gets a compact pile.

Example:

```text
Player 1
3 pts
[ 2 defeated ]
```

Clicking it expands a tray/modal containing the defeated cards.

The shared player-card discard pile is **not inspectable**.

---

## 14. Development Philosophy

Prefer:

- Small files
- Explicit state transitions
- Pure rules functions
- Strong TypeScript types
- Tests for gameplay rules
- Data-driven cards
- Reusable visual components

Avoid:

- Rule logic hidden in UI components
- Storing whole card definitions repeatedly in state
- Large abstractions before the game works
- Building online multiplayer during v1
- Building mobile layout before desktop play is solid

The goal is to make the simplest version that is already architecturally ready to grow.
