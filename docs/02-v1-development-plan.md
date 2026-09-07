# Monster Mania — V1 Development Plan

> **Goal:** Deliver a polished, complete 2-player local desktop game before mobile or online multiplayer.

---

# Stage 0 — Repository Foundation

## Goals

Establish the project and source-of-truth structure before gameplay work.

## Tasks

- Create Vite + React + TypeScript app
- Enable strict TypeScript
- Add ESLint / formatting conventions
- Add Vitest
- Create `/docs`
- Add visual design guide
- Add rules source of truth
- Create asset directories
- Add design tokens
- Add Monster Mania logo
- Add card templates
- Add weapon icons

## Deliverable

The app boots to a minimal Monster Mania shell with no gameplay yet.

---

# Stage 1 — Data Model + Asset Registry

## Goals

Represent every card and Monster as data.

## Build

- `WeaponId`
- `PlayerCardDefinition`
- `PlayerCardInstance`
- `MonsterDefinition`
- `PlayerState`
- `GameState`
- Asset registry
- Monster data
- Player-card deck definition

Use unique card instance IDs even when multiple cards share one definition.

Example:

```ts
interface PlayerCardInstance {
	instanceId: string;
	cardId: PlayerCardId;
}
```

This avoids ambiguity when discarding one of several identical cards.

## Deliverable

A development screen can render:

- Every Weapon icon
- Every Monster definition
- Every card definition
- Counts matching the physical game

---

# Stage 2 — Reusable Card Components

## Goals

Rebuild the physical-card look using layered web components.

## Components

```text
WeaponIcon
MonsterCard
WeaponCard
DrawCard
BlackHoleCard
CardBack
```

## MonsterCard responsibilities

- Template frame
- Artwork
- Point value
- Name
- Type label
- Requirement icons
- Lore

## Requirements

- No full-card flattened images required
- Responsive within fixed aspect ratio
- `small`, `medium`, `large` sizes
- Correct requirement icons from real assets

## Deliverable

A card gallery page showing all game cards consistently.

---

# Stage 3 — Core Rules Engine

## Goals

Implement gameplay without depending on the final board UI.

## Build pure functions

```ts
createGame()
shuffle()
dealStartingHands()
canDefeatMonster()
getRequiredCardInstances()
playDrawCard()
beginSkip()
selectDiscard()
confirmDiscard()
defeatMonster()
useBlackHole()
replaceMonster()
recycleDrawDeck()
advanceTurn()
calculateScore()
shouldStartSuddenDeath()
startSuddenDeath()
```

## Phase model

Recommended:

```ts
type GamePhase =
	| 'setup'
	| 'turn-ready'
	| 'playing'
	| 'forced-discard-after-draw'
	| 'forced-discard-before-skip'
	| 'turn-handoff'
	| 'sudden-death-ready'
	| 'sudden-death'
	| 'game-over';
```

## Deliverable

The game can be played from unit tests or a developer console without the final UI.

---

# Stage 4 — Rules Sandbox

## Goal

Create a permanent development utility for testing edge cases quickly.

Route or dev-only screen:

```text
/dev/rules
```

## Useful controls

- Start fresh game
- Select current player
- Give player a specific card
- Fill hand to 5
- Set draw pile size
- Force draw pile empty
- Spawn specific Monsters
- Set only 3 Monsters remaining
- Give Black Hole
- Force score tie
- Start Sudden Death
- Give Infinity Beast requirement
- View raw serialized `GameState`

## Why Keep It

This will dramatically reduce debugging time.

Do not delete it after launch.

Hide it from production navigation if desired.

---

# Stage 5 — Desktop Game Board

## Goals

Build the real 2-player local interface.

## Main UI

- Header
- Player scores
- Current player
- Monster row
- Monster deck count
- Player hand
- Draw pile count
- Defeated pile
- Contextual controls
- Compact event log

## Monster interaction

If a Monster is beatable:

- visually indicate eligibility
- click Monster
- show confirmation
- apply defeat

If multiple Monsters are beatable:

- all valid Monsters can be selected

## Deliverable

A complete normal turn can be played visually.

---

# Stage 6 — Draw + Forced Discard Flows

## Draw Card Flow

1. Click Draw card.
2. Animate/resolve draw.
3. Show complete new hand.
4. If over hand limit:
	- enter forced discard
	- select enough cards
	- confirm
5. Resume normal turn.

## Skip Flow Under Limit

1. Click Skip.
2. Draw 1.
3. End turn.

## Skip Flow At Limit

1. Click Skip.
2. Enter discard-before-skip.
3. Select 1 card.
4. Confirm.
5. Draw 1.
6. End turn.

## Deliverable

Hand-limit behavior exactly matches tabletop rules.

---

# Stage 7 — Pass-and-Play Turn Handoff

## Goals

Protect private hands.

## End-turn flow

```text
Player 1 turn ends
→ hand disappears
→ handoff screen
→ Player 2 clicks Reveal Hand
→ Player 2 begins
```

## Handoff component

```tsx
<TurnHandoff
	nextPlayerName="Player 2"
	onReveal={...}
/>
```

No other player's hand should remain visible behind the overlay.

## Deliverable

Two people can comfortably share one desktop screen.

---

# Stage 8 — Monster Lifecycle + Deck Recycling

Implement and visually verify:

- Monster replacement
- Final-three behavior
- Player draw deck recycling
- Monster rotation on recycle when 4+ remain
- No Monster rotation when fewer than 4 remain

Add event log messages for these system actions.

## Deliverable

A full match can reach its natural ending without manual intervention.

---

# Stage 9 — Black Hole

## Requirements

- Black Hole visibly looks special
- Can target any normal Monster
- Discards only itself
- Ends turn after defeat
- Does not consume normal Weapons
- Removed before Sudden Death

## Deliverable

Black Hole behavior passes tests and works in UI.

---

# Stage 10 — Scoring + Defeated Piles

## Score display

Always visible.

## Defeated pile

Compact collapsed state:

```text
[ stack ] 3 defeated
```

On click:

- open tray/modal
- show defeated Monster cards
- close without affecting game

Shared discard pile remains non-inspectable.

## Deliverable

Players can review their own defeated Monsters without cluttering the board.

---

# Stage 11 — End Game + Sudden Death

## Normal victory

When regular Monsters are exhausted:

- calculate score
- show winner if not tied

## Tie

Transition to Sudden Death.

### Setup

- Remove Black Hole
- Reduce hand limit to 4
- Force discard down to 4 if necessary
- Show special transition
- Reveal The Infinity Beast

### Play

- Infinity Beast requires:
	- Grenade
	- Sword
	- Gun

First successful defeat wins immediately.

## UI

Infinity Beast should receive:

- special point medallion with `∞`
- stronger visual treatment
- Sudden Death label/banner
- dramatic but fast transition

## Deliverable

Every possible match conclusion is complete.

---

# Stage 12 — Save + Resume

## localStorage

Save after every valid state transition.

Include:

- schema version
- game state
- timestamp

## Startup

If a saved game exists:

```text
Monster Mania

[ Resume Game ]

[ New Game ]
```

Starting a new game should ask before replacing an active saved game.

## Deliverable

Browser refreshes do not destroy a match.

---

# Stage 13 — Audio Hooks

Do not spend significant design time here.

Add:

- audio service
- mute setting
- event-to-sound mapping

Initial sounds may be omitted.

The architecture should support them later without touching game rules.

---

# Stage 14 — Polish + QA

## Visual

- Card hover lift
- Requirement highlight
- Current-player emphasis
- Defeat animation
- Smooth handoff
- Infinity Beast entrance
- Reduced-motion support

## Accessibility

- Buttons keyboard accessible
- Useful aria labels
- No state conveyed by color alone
- Focus management in dialogs
- Readable text contrast

## QA

Play many full games.

Use Rules Sandbox for edge cases.

---

# V1 Definition of Done

V1 is done when:

- 2 players can start a local game
- hands remain private
- all normal rules work
- all Monsters work
- Draw 1 / Draw 2 work
- forced discards work
- Black Hole works
- deck recycle behavior is correct
- final-three behavior is correct
- scores are correct
- defeated piles work
- Sudden Death works
- refresh resumes the game
- desktop UI feels complete
- automated rules tests pass

Mobile optimization is a separate milestone after this.
