# Monster Mania — Rules Source of Truth

> **Purpose:** Canonical digital-game rules for implementation and tests.  
> If code behavior conflicts with this file, fix the code or update this document intentionally.

---

# 1. Players

Current product modes:

- Exactly 2 participants
- Solo Game: 1 local human and 1 computer controller
- Future Online Table: 2 remote-human controllers on separate clients
- Each participant has a private hand

Controller type determines who chooses an action, not which gameplay rules apply. Local humans, remote humans, and computers submit the same `GameAction`s to the same engine. The rules should not unnecessarily assume that future versions can never support more participants, but MVP behavior and tests target exactly 2.

---

# 2. Standard Game Format

A standard game uses:

```text
18 Weapon cards
5 Action cards
1 Ultimate Weapon card
= 24 shared player cards

17 regular Monster cards
1 dedicated Sudden Death Monster
```

Expansions may introduce different card identities that can be mixed into the game.

Unless an expansion explicitly changes deck construction, the standard category totals remain:

- 18 Weapons
- 5 Actions
- 1 Ultimate Weapon
- 17 regular Monsters
- 1 Sudden Death Monster

The distribution of regular Monsters by point value is **not** fixed by the core rules.

A compatible Monster set may contain more 2-point Monsters, fewer 1-point Monsters, or another supported distribution while still containing exactly 17 regular Monsters.

---

# 3. Starting the Game

- Build and shuffle the 24-card shared player Draw deck.
- Shuffle the 17-card regular Monster deck.
- Keep the Sudden Death Monster separate.
- Each player starts with **3 cards**.
- Place **2 regular Monsters face-up**.
- Randomly choose a starting player unless manually overridden by a dev/testing tool.
- Normal maximum hand size is **5**.

---

# 4. Core Shared Player Draw Deck

The core set uses the standard 24-card structure.

## Weapons

There are **3 copies each** of:

- Bow
- Grenade
- Mace
- Sword
- Spear
- Gun / Rifle

Total:

```text
18 Weapon cards
```

## Actions

The core set contains:

- Draw 1 × 3
- Draw 2 × 2

Total:

```text
5 Action cards
```

## Ultimate Weapon

The core set contains:

- Black Hole × 1

Total:

```text
1 Ultimate Weapon
```

## Core Total

```text
18 Weapons
+ 5 Actions
+ 1 Ultimate Weapon
= 24 cards
```

The engine should model these as card categories and definitions, not as assumptions that Draw 1, Draw 2, and Black Hole are the only cards that can ever occupy those categories.

---

# 5. Normal Turn

A normal turn has two stages:

1. Action Phase
2. Resolve the Turn

Only **one Monster may be defeated per turn**.

After a Monster is defeated, the turn ends.

---

## 5.1 Action Phase

During the Action Phase, the current player may play any number of Action cards.

Action cards resolve one at a time.

After one Action resolves, the player may play another Action card.

Cards gained from an Action are immediately playable.

Example:

```text
Player plays Draw 2.
One of the drawn cards is Draw 1.
The player may immediately play that Draw 1.
```

There is no normal limit to how many Action cards may be chained during the Action Phase.

Once the player begins playing Weapon cards or an Ultimate Weapon to defeat a Monster, the Action Phase is over for that turn.

The player may not return to the Action Phase after beginning a Monster-defeat attempt.

---

## 5.2 Resolve the Turn

After the player finishes the Action Phase, they must either:

- Defeat one face-up Monster if able
- Or skip

A player cannot defeat a Monster and then play an Action card afterward.

---

# 6. Action Cards

Action cards are a general card category.

Each Action card definition supplies the effect that occurs when the card is played.

Normal Action resolution:

1. Validate that the card can legally be played during the current Action Phase.
2. Resolve the card's effect completely.
3. Unless the card states otherwise, move the Action card to the shared discard pile.
4. Return control to the player's Action Phase.

Playing an Action card does **not** consume the player's Monster-defeat opportunity.

Playing an Action card does **not** end the turn unless the card specifically says that it does.

Future expansions may add new Action effects without changing these core timing rules.

---

## 6.1 Draw Actions

Some Action cards instruct the player to draw one or more cards.

For a Draw Action:

1. Resolve the full draw amount.
2. Add all drawn cards to the player's hand.
3. If the hand is above the current limit, enter forced-discard flow.
4. After the hand limit is resolved, return to the Action Phase.

Cards drawn through an Action are immediately playable after any required hand-limit cleanup.

### Core Draw 1

Effect:

```text
Draw 1 card.
```

### Core Draw 2

Effect:

```text
Draw 2 cards.
```

The core set contains 3 Draw 1 cards and 2 Draw 2 cards, but those counts are inventory data rather than separate rules-engine concepts.

---

# 7. Hand Limit

Normal hand limit:

**5 cards**

Sudden Death hand limit:

**4 cards**

Voluntary discarding is **not allowed**.

Cards are discarded only when required by rules or card effects.

---

## 7.1 Forced Discard After a Draw Action

The player always receives the full draw first.

Then:

1. Show the player's complete updated hand.
2. Determine how many cards must be discarded to reach the current hand limit.
3. The player selects exactly that many cards.
4. Selected cards go to the shared discard pile.
5. The player returns to the Action Phase.

Example:

```text
Player has 5 cards.
Player plays Draw 2.

The Action resolves.
Player draws 2 cards.
Because the Draw 2 itself leaves the hand when played,
the player now has 6 cards.

Player chooses 1 card to discard.
Player returns to 5 cards.
Action Phase continues.
```

The forced-discard phase is a legal temporary state in which a hand may exceed its normal maximum.

---

# 8. Skipping

If the player does not defeat a Monster, they may skip.

Skipping always ends the turn.

## If the player has fewer than the current hand limit

1. Draw 1 card.
2. End the turn immediately.

The player may not play the card they just drew.

## If the player is exactly at the current hand limit

1. Enter forced-discard-before-skip flow.
2. Player chooses exactly 1 card to discard.
3. Draw 1 card.
4. End the turn immediately.

The newly drawn card cannot be played that turn.

Skipping is **not** an Action card effect and does not reopen the Action Phase.

---

# 9. Defeating a Regular Monster

A regular Monster is defeated when the player satisfies the Weapon requirement shown on that Monster, unless an Ultimate Weapon provides an alternate defeat method.

Example:

```text
Ground Worm
Grenade + Gun + Mace
```

Normal Weapon defeat flow:

1. Validate that the current player's hand contains the exact required Weapon types.
2. Player chooses and confirms the target Monster.
3. Required Weapon instances are discarded.
4. Monster moves to that player's defeated-Monster pile.
5. Add the Monster's point value to the player's score.
6. Replace the Monster when normal replacement rules allow.
7. End the player's turn.

Extra unrelated cards in the player's hand do not prevent the defeat.

If multiple face-up Monsters can be defeated, the player chooses which one.

Only the required Weapon instances are discarded.

---

# 10. Ultimate Weapons

Ultimate Weapon is a general card category.

A standard game contains exactly **1 Ultimate Weapon**.

Unless the card definition says otherwise, an Ultimate Weapon:

- Is used only after the Action Phase
- Defeats one eligible regular face-up Monster without its normal Weapon requirement
- Counts as the player's one Monster defeat for the turn
- Is discarded after use
- Ends the turn after the Monster is defeated
- Cannot be used against the Sudden Death Monster

Ultimate Weapons are removed from play before Sudden Death.

---

## 10.1 Black Hole

The core set's Ultimate Weapon is the Black Hole.

When used:

1. Player chooses any face-up regular Monster.
2. Discard only the Black Hole.
3. Do not discard the Monster's normal Weapon requirements.
4. Defeat the Monster normally.
5. End the turn.

The Black Hole cannot be voluntarily combined with normal Weapons.

The Black Hole cannot target The Infinity Beast.

---

# 11. Monster Board

Normally:

**2 regular Monsters are face-up.**

When a Monster is defeated:

- Draw a replacement from the Monster deck immediately unless final-three rules are active.

---

# 12. Final Three Monsters

When exactly **3 undefeated regular Monsters remain**:

- Put all 3 on the board face-up.
- Do not replace defeated Monsters after this point.

As they are defeated, the board shrinks:

```text
3 → 2 → 1 → 0
```

---

# 13. Recycling the Player Draw Deck

When the shared player Draw pile is depleted:

## If 4 or more undefeated regular Monsters remain

1. Take the currently face-up Monsters.
2. Move them to the **bottom of the existing Monster deck**.
3. Draw new Monsters for the face-up slots.
4. Shuffle the shared player discard pile.
5. The shuffled discard pile becomes the new player Draw pile.
6. Continue play.

## If fewer than 4 undefeated regular Monsters remain

1. Do **not** rotate the face-up Monsters.
2. Shuffle the shared player discard pile.
3. The shuffled discard pile becomes the new player Draw pile.
4. Continue play.

The recycle system must preserve every player-card instance, including cards in any valid removed-from-game zone.

---

# 14. Scores and Monster Point Values

In the core set:

- 1-point Monster → 2-Weapon requirement
- 2-point Monster → 3-Weapon requirement
- 3-point Monster → 4-Weapon requirement

A player's score is the sum of the point values of their defeated regular Monsters.

The standard rules do **not** require a fixed number of Monsters at each point value.

The current core set uses:

```text
11 × 1-point
5 × 2-point
1 × 3-point
= 17 regular Monsters
```

Future compatible Monster pools may use a different point distribution while preserving the 17-Monster total.

---

# 15. End of Regular Game

When every regular Monster has been defeated:

1. Calculate each player's score.
2. If one player has the highest score, that player wins.
3. If two or more players are tied for the highest score, only those tied players enter Sudden Death.

---

# 16. Sudden Death

Sudden Death uses one dedicated Monster.

The core set uses:

**The Infinity Beast**

Its point display is:

**∞**

The infinity symbol represents instant victory rather than a numeric score.

---

## 16.1 Sudden Death Setup

- Only players tied for the highest score participate.
- Remove the Ultimate Weapon from play, wherever it currently is.
- Maximum hand size becomes **4**.
- If a tied player's hand exceeds 4, they must discard down to 4 before Sudden Death begins.
- The dedicated Sudden Death Monster becomes active.
- Normal Action Phase rules continue.
- Normal skip rules continue.
- Ultimate Weapons cannot be used.

---

## 16.2 Action Cards in Sudden Death

Action cards continue to function normally.

Players may:

- Play multiple Actions in one Action Phase
- Chain newly received Action cards
- Resolve Draw Actions normally

If a Draw Action takes a player's hand above 4 cards:

1. Resolve the full draw.
2. Enter forced-discard flow.
3. Discard down to 4.
4. Continue the Action Phase.

---

## 16.3 Infinity Beast Requirement

The Infinity Beast requires:

- Gun / Rifle
- Spear
- Grenade
- Sword

Because Sudden Death's hand limit is four, this is a complete four-card hand rather than a partial requirement.

The first tied player to defeat The Infinity Beast wins immediately.

The Infinity Beast does not add to the normal point total.

---

# 17. Core Monster Definitions

```ts
export const monsters = [
	{
		id: 'socket',
		name: 'Socket',
		points: 1,
		requiredWeapons: ['gun', 'spear'],
	},
	{
		id: 'top',
		name: 'Top',
		points: 1,
		requiredWeapons: ['grenade', 'sword'],
	},
	{
		id: 'bitty-bitey',
		name: 'Bitty Bitey',
		points: 1,
		requiredWeapons: ['mace', 'spear'],
	},
	{
		id: 'flower-trap',
		name: 'Flower Trap',
		points: 1,
		requiredWeapons: ['mace', 'bow'],
	},
	{
		id: 'smasher',
		name: 'Smasher',
		points: 1,
		requiredWeapons: ['bow', 'mace'],
	},
	{
		id: 'wrecking-snake',
		name: 'Wrecking Snake',
		points: 1,
		requiredWeapons: ['spear', 'sword'],
	},
	{
		id: 'boom-boom',
		name: 'Boom Boom',
		points: 1,
		requiredWeapons: ['spear', 'gun'],
	},
	{
		id: 'rocket-chomper',
		name: 'Rocket Chomper',
		points: 1,
		requiredWeapons: ['grenade', 'spear'],
	},
	{
		id: 'wacker',
		name: 'Wacker',
		points: 1,
		requiredWeapons: ['mace', 'sword'],
	},
	{
		id: 'chomper',
		name: 'Chomper',
		points: 1,
		requiredWeapons: ['grenade', 'sword'],
	},
	{
		id: 'slice-and-dice',
		name: 'Slice and Dice',
		points: 1,
		requiredWeapons: ['sword', 'spear'],
	},
	{
		id: 'pincher',
		name: 'Pincher',
		points: 2,
		requiredWeapons: ['grenade', 'spear', 'sword'],
	},
	{
		id: 'rock-crab',
		name: 'Rock Crab',
		points: 2,
		requiredWeapons: ['grenade', 'gun', 'bow'],
	},
	{
		id: 'ground-worm',
		name: 'Ground Worm',
		points: 2,
		requiredWeapons: ['grenade', 'gun', 'mace'],
	},
	{
		id: 'spikey',
		name: 'Spikey',
		points: 2,
		requiredWeapons: ['bow', 'sword', 'spear'],
	},
	{
		id: 'kraken',
		name: 'Kraken',
		points: 2,
		requiredWeapons: ['bow', 'gun', 'grenade'],
	},
	{
		id: 'thing',
		name: 'Thing',
		points: 3,
		requiredWeapons: ['gun', 'spear', 'grenade', 'bow'],
	},
] as const;
```

---

# 18. Core Action Definitions

The engine should represent Action behavior as card-definition data or a small effect registry.

Conceptual shape:

```ts
export const actionCards = [
	{
		id: 'draw-1',
		name: 'Draw 1',
		category: 'action',
		effect: {
			type: 'draw',
			count: 1,
		},
		copies: 3,
	},
	{
		id: 'draw-2',
		name: 'Draw 2',
		category: 'action',
		effect: {
			type: 'draw',
			count: 2,
		},
		copies: 2,
	},
] as const;
```

The exact implementation may differ, but rules code should dispatch through the card definition rather than branch only on `draw-1` and `draw-2`.

---

# 19. Core Ultimate Weapon Definition

Conceptual shape:

```ts
export const blackHole = {
	id: 'black-hole',
	name: 'Black Hole',
	category: 'ultimate-weapon',
	copies: 1,
	effect: {
		type: 'defeat-any-regular-monster',
	},
} as const;
```

---

# 20. Infinity Beast Definition

```ts
export const infinityBeast = {
	id: 'infinity-beast',
	name: 'The Infinity Beast',
	points: 'infinity',
	requiredWeapons: ['gun', 'spear', 'grenade', 'sword'],
} as const;
```

---

# 21. UX-Specific Rules

- Shared discard pile is not inspectable.
- Defeated Monsters are represented as a compact pile.
- A player may click their defeated pile to expand and review it.
- In Solo, the computer's hand identities are hidden from the human player.
- In an Online Table, a client receives only its participant's hand; the opponent hand is represented by a count or card backs.
- Action cards should visually indicate when they are playable.
- Once Weapon or Ultimate Weapon play begins, Action cards are no longer playable that turn.
- Forced-discard flows must show the complete updated hand before the player chooses discards.
