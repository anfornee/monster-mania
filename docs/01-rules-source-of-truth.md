# Monster Mania — Rules Source of Truth

> **Purpose:** Canonical digital-game rules for implementation and tests.  
> If code behavior conflicts with this file, fix the code or update this document intentionally.

---

# 1. Players

Initial version:

- Exactly 2 players
- Shared device
- Pass-and-play
- Each player has a private hand

---

# 2. Starting the Game

- Shuffle the shared player draw deck.
- Shuffle the regular Monster deck.
- Each player starts with **3 cards**.
- Place **2 regular Monsters face-up**.
- Randomly choose a starting player unless manually overridden by a dev/testing tool.
- Normal maximum hand size is **5**.

---

# 3. Shared Player Draw Deck

There is one shared player draw deck.

## Weapons

There are **3 copies each** of:

- Bow
- Grenade
- Mace
- Sword
- Spear
- Gun / Rifle

## Draw Cards

- Draw 1 × 3
- Draw 2 × 2

## Special

- Black Hole × 1

## Total

```text
18 weapon cards
+ 3 Draw 1
+ 2 Draw 2
+ 1 Black Hole
= 24 cards
```

---

# 4. Normal Turn

During a normal turn a player may:

- Play one or more Draw cards
- Defeat one face-up Monster if able
- Or skip

A Draw card does **not** consume the player's Monster-defeat opportunity.

Only **one Monster may be defeated per turn**.

After a Monster is defeated, the turn ends.

---

# 5. Draw Cards

## Draw 1

When played:

1. Discard the Draw 1 card.
2. Draw 1 card.
3. If above the hand limit, enter forced-discard flow.
4. Return to normal play after resolving the hand limit.

## Draw 2

When played:

1. Discard the Draw 2 card.
2. Draw 2 cards.
3. If above the hand limit, enter forced-discard flow.
4. Return to normal play after resolving the hand limit.

A player may continue playing after a Draw card resolves.

---

# 6. Hand Limit

Normal hand limit:

**5 cards**

Voluntary discarding is **not allowed**.

Cards are discarded only when required by rules.

---

## Forced Discard After a Draw Card

The player draws the full number of cards first.

Then:

1. Show the player's complete updated hand.
2. The player selects enough cards to return to 5 cards.
3. Selected cards go to the shared discard pile.
4. The player resumes their turn.

Example:

```text
Player has 5 cards.
Player uses Draw 2.

The Draw 2 card itself is discarded.
Player draws 2.
Player now has 6 cards.

Player chooses 1 card to discard.
Player returns to 5 cards.
Turn continues.
```

---

# 7. Skipping

If the player does not defeat a Monster, they may skip.

Skipping always ends the turn.

## If player has fewer than 5 cards

1. Draw 1 card.
2. End turn immediately.

The player may not play the card they just drew.

## If player has exactly 5 cards

1. Enter forced-discard-before-skip flow.
2. Player chooses exactly 1 card to discard.
3. Draw 1 card.
4. End turn immediately.

The newly drawn card cannot be played that turn.

---

# 8. Defeating a Monster

A regular Monster is defeated when the player has every Weapon required by that Monster.

Example:

```text
Ground Worm
Grenade + Gun + Mace
```

To defeat it:

1. Validate the required Weapon cards exist in the current player's hand.
2. Player confirms the target Monster.
3. Required Weapon cards are discarded.
4. Monster moves to that player's defeated-monster pile.
5. Add its point value to the player's score.
6. Replace the Monster when normal replacement rules allow.
7. End the player's turn.

If multiple face-up Monsters can be defeated, the player chooses which one.

---

# 9. Black Hole

There is exactly one Black Hole card.

The Black Hole can defeat any **regular** face-up Monster.

When used:

1. Player chooses a face-up regular Monster.
2. Discard only the Black Hole.
3. Do not discard the Monster's normal Weapon requirements.
4. Defeat the Monster normally.
5. End the turn.

The Black Hole cannot be voluntarily combined with other Weapons.

The Black Hole is not used in Sudden Death.

---

# 10. Monster Board

Normally:

**2 Monsters are face-up.**

When a Monster is defeated:

- Draw a replacement from the Monster deck immediately unless final-three rules are active.

---

# 11. Final Three Monsters

When exactly **3 undefeated regular Monsters remain**:

- Put all 3 on the board face-up.
- Do not replace defeated Monsters after this point.

As they are defeated, the board shrinks:

```text
3 → 2 → 1 → 0
```

---

# 12. Recycling the Player Draw Deck

When the shared player draw pile is depleted:

## If 4 or more undefeated regular Monsters remain

1. Take the currently face-up Monsters.
2. Move them to the **bottom of the existing Monster deck**.
3. Draw new Monsters for the face-up slots.
4. Shuffle the shared player discard pile.
5. The shuffled discard pile becomes the new player draw pile.
6. Continue play.

## If fewer than 4 undefeated regular Monsters remain

1. Do **not** rotate the face-up Monsters.
2. Shuffle the shared player discard pile.
3. The shuffled discard pile becomes the new player draw pile.
4. Continue play.

---

# 13. Scores

Regular Monster values:

- 1-point Monster → 2-Weapon requirement
- 2-point Monster → 3-Weapon requirement
- 3-point Monster → 4-Weapon requirement

A player's score is the sum of defeated regular Monsters.

---

# 14. End of Regular Game

When every regular Monster has been defeated:

1. Calculate both players' scores.
2. If one player has the higher score, that player wins.
3. If the scores are tied, begin Sudden Death.

---

# 15. Sudden Death

Sudden Death uses a dedicated Monster:

**The Infinity Beast**

Its point display is:

**∞**

The infinity symbol represents instant victory rather than a numeric score.

---

## Sudden Death Setup

- Only tied players participate.
- Remove the Black Hole from play.
- Maximum hand size becomes **4**.
- If a player's hand exceeds 4, they must discard down to 4 before Sudden Death begins.
- The Infinity Beast becomes the active Monster.
- Normal draw and skip concepts continue.

---

## Infinity Beast Requirement

The Infinity Beast requires:

- Grenade
- Sword
- Gun / Rifle

The first player to defeat The Infinity Beast wins immediately.

The Infinity Beast does not add to the normal point total.

---

# 16. Monster Definitions

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
		id: 'rocket-chopper',
		name: 'Rocket Chopper',
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

# 17. Infinity Beast Definition

```ts
export const infinityBeast = {
	id: 'infinity-beast',
	name: 'The Infinity Beast',
	points: 'infinity',
	requiredWeapons: ['grenade', 'sword', 'gun'],
} as const;
```

---

# 18. UX-Specific Rules

- Shared discard pile is not inspectable.
- Defeated Monsters are represented as a compact pile.
- A player may click their defeated pile to expand and review it.
- Player hands are hidden during turn handoff.
- Only the active player's hand should be visible.
