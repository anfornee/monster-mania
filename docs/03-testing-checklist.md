# Monster Mania — Rules Testing Checklist

> **Purpose:** Core Vitest coverage for the rules engine.

---

## Game Setup

- [ ] Shared player deck contains exactly 24 cards
- [ ] 3 copies each of six standard Weapons
- [ ] 3 Draw 1 cards
- [ ] 2 Draw 2 cards
- [ ] 1 Black Hole
- [ ] Each player starts with 3 cards
- [ ] Exactly 2 Monsters start face-up
- [ ] Regular hand limit starts at 5

---

## Draw Cards

- [ ] Draw 1 discards itself
- [ ] Draw 1 draws exactly 1
- [ ] Draw 2 discards itself
- [ ] Draw 2 draws exactly 2
- [ ] Player may continue turn after Draw 1
- [ ] Player may continue turn after Draw 2
- [ ] Multiple Draw cards can be played in one turn
- [ ] Over-limit draw enters forced-discard state
- [ ] Player cannot leave forced-discard state above limit
- [ ] Voluntary discard is rejected outside allowed phases

---

## Skip

- [ ] Skip below hand limit draws 1
- [ ] Skip below hand limit ends turn
- [ ] Player cannot play newly drawn skip card
- [ ] Skip at hand limit requires discard first
- [ ] Exactly one discard is selected before skip draw
- [ ] Skip-at-limit then draws exactly 1
- [ ] Skip-at-limit ends turn

---

## Monster Defeat

- [ ] Exact Weapon requirements succeed
- [ ] Missing requirement fails
- [ ] Extra unrelated hand cards do not block defeat
- [ ] Required Weapon instances are discarded
- [ ] Only required cards are discarded
- [ ] Defeated Monster moves to player's defeated pile
- [ ] Correct points are awarded
- [ ] Turn ends after defeat
- [ ] Second Monster cannot be defeated in same turn
- [ ] Player may choose between multiple beatable Monsters

---

## Black Hole

- [ ] Black Hole defeats any normal face-up Monster
- [ ] Only Black Hole is discarded
- [ ] Normal requirement Weapons remain in hand
- [ ] Turn ends
- [ ] Black Hole cannot target Infinity Beast
- [ ] Black Hole is removed before Sudden Death

---

## Monster Replacement

- [ ] Defeated Monster is replaced when more than 3 undefeated remain
- [ ] Replacement comes from Monster deck
- [ ] Final-three state puts all 3 Monsters face-up
- [ ] No replacement occurs after final-three starts
- [ ] Board shrinks from 3 to 2 to 1 to 0

---

## Draw Deck Recycling

When 4+ regular Monsters remain:

- [ ] Face-up Monsters move to bottom of Monster deck
- [ ] New face-up Monsters are drawn
- [ ] Player discard pile is shuffled into new draw pile
- [ ] Discard pile becomes empty

When fewer than 4 remain:

- [ ] Face-up Monsters do not rotate
- [ ] Player discard pile is shuffled into new draw pile
- [ ] Discard pile becomes empty

---

## Scoring

- [ ] 1-point Monsters contribute 1
- [ ] 2-point Monsters contribute 2
- [ ] Thing contributes 3
- [ ] Total score matches defeated pile
- [ ] Higher score wins when regular Monsters are exhausted
- [ ] Equal score triggers Sudden Death

---

## Sudden Death Setup

- [ ] Infinity Beast becomes active
- [ ] Point value represented as `infinity`
- [ ] Hand limit changes to 4
- [ ] Players above 4 must discard down
- [ ] Black Hole is removed
- [ ] Required Weapons are Grenade + Sword + Gun

---

## Sudden Death Victory

- [ ] Missing Infinity Beast requirement fails
- [ ] Correct requirement succeeds
- [ ] Required cards are discarded
- [ ] Successful defeat immediately sets winner
- [ ] No numeric points are added
- [ ] Game enters game-over state

---

## Privacy / Handoff State

- [ ] Turn end enters handoff
- [ ] Active hand is hidden during handoff
- [ ] Reveal action only reveals next player's hand
- [ ] Previous player's hand remains inaccessible from normal UI selectors

---

## Persistence

- [ ] Game state serializes to JSON
- [ ] Serialized state restores correctly
- [ ] Current phase restores correctly
- [ ] Hands restore correctly
- [ ] Deck orders restore correctly
- [ ] Defeated piles restore correctly
- [ ] Sudden Death state restores correctly
- [ ] Schema version is validated
