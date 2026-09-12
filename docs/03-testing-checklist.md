# Monster Mania — Rules Testing Checklist

> **Purpose:** Required coverage for the shared rules engine, playable Solo Game, and future Online Table boundary. The same engine behavior applies to every controller type.

---

## Standard Game Setup

- [ ] Shared player deck contains exactly 24 cards
- [ ] Shared player deck contains exactly 18 Weapon cards
- [ ] Shared player deck contains exactly 5 Action cards
- [ ] Shared player deck contains exactly 1 Ultimate Weapon
- [ ] Core deck contains 3 copies each of six standard Weapons
- [ ] Core deck contains 3 Draw 1 cards
- [ ] Core deck contains 2 Draw 2 cards
- [ ] Core deck contains 1 Black Hole
- [ ] Regular Monster deck contains exactly 17 Monsters
- [ ] Sudden Death Monster is separate from the regular Monster deck
- [ ] Each player starts with 3 cards
- [ ] Exactly 2 regular Monsters start face-up
- [ ] Regular hand limit starts at 5

## Participants and Controllers

- [ ] A standard game always has exactly 2 participants
- [ ] Solo setup creates 1 local human and 1 computer controller
- [ ] Controller type does not change legal actions or rules-engine behavior
- [ ] A computer action is applied only through `applyGameAction`
- [ ] A remote-human action uses the same `GameAction` contract as a local-human action

---

## Expansion-Friendly Deck Invariants

- [ ] Standard validation accepts different legal Action identities while preserving 5 total Actions
- [ ] Standard validation accepts a different legal Ultimate Weapon identity while preserving 1 total Ultimate Weapon
- [ ] Standard validation accepts a different 17-Monster point distribution
- [ ] Standard validation rejects fewer or more than 17 regular Monsters unless a variant explicitly changes construction
- [ ] Monster scoring derives from card definitions rather than a hard-coded 11 / 5 / 1 split

---

## Action Phase

- [ ] Current player may play an Action during the Action Phase
- [ ] Non-current player cannot play an Action
- [ ] Multiple Action cards can be played in one Action Phase
- [ ] Action cards resolve one at a time
- [ ] An Action received from another Action can be played immediately
- [ ] Playing an Action does not consume the Monster-defeat opportunity
- [ ] Playing an Action does not end the turn unless its definition says so
- [ ] Action card enters discard after resolving unless its definition says otherwise
- [ ] Once Weapon / Ultimate Weapon Monster-defeat play begins, Action cards cannot be played that turn
- [ ] Turn cannot return to the Action Phase after Monster-defeat play begins

---

## Core Draw Actions

- [ ] Draw 1 uses the generic Action-card path
- [ ] Draw 1 draws exactly 1
- [ ] Draw 2 uses the generic Action-card path
- [ ] Draw 2 draws exactly 2
- [ ] Player may continue Action Phase after Draw 1
- [ ] Player may continue Action Phase after Draw 2
- [ ] Draw 1 can draw Draw 1 and allow it to be played
- [ ] Draw 1 can draw Draw 2 and allow it to be played
- [ ] Draw 2 can draw one or more Actions and allow them to be played
- [ ] Full draw resolves before hand-limit cleanup
- [ ] Over-limit Action draw enters forced-discard state
- [ ] Player cannot leave forced-discard state above limit
- [ ] Voluntary discard is rejected outside allowed phases/effects

---

## Skip

- [ ] Skip below hand limit draws 1
- [ ] Skip below hand limit ends turn
- [ ] Player cannot play newly drawn skip card
- [ ] Skip at hand limit requires discard first
- [ ] Exactly one discard is selected before skip draw
- [ ] Skip-at-limit then draws exactly 1
- [ ] Skip-at-limit ends turn
- [ ] Skip does not reopen the Action Phase

---

## Monster Defeat

- [ ] Exact Weapon requirements succeed
- [ ] Missing requirement fails
- [ ] Extra unrelated hand cards do not block defeat
- [ ] Required Weapon instances are discarded
- [ ] Only required cards are discarded
- [ ] Defeated Monster moves to player's defeated pile
- [ ] Correct points are awarded from Monster definition
- [ ] Turn ends after defeat
- [ ] Second Monster cannot be defeated in same turn
- [ ] Player may choose between multiple beatable Monsters

---

## Ultimate Weapon

- [ ] Standard game contains exactly 1 Ultimate Weapon
- [ ] Ultimate Weapon cannot be used after another Monster has already been defeated
- [ ] Ultimate Weapon use counts as the turn's Monster defeat
- [ ] Ultimate Weapon ends turn after successful defeat unless definition says otherwise
- [ ] Ultimate Weapon is unavailable in Sudden Death
- [ ] Ultimate Weapon cannot target Sudden Death Monster unless a future explicit rule overrides this

---

## Core Black Hole

- [ ] Black Hole is categorized as an Ultimate Weapon
- [ ] Black Hole defeats any regular face-up Monster
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
- [ ] Behavior depends on remaining Monster count, not point-value distribution

---

## Draw Deck Recycling

When 4+ regular Monsters remain:

- [ ] Face-up Monsters move to bottom of Monster deck
- [ ] New face-up Monsters are drawn
- [ ] Player discard pile is shuffled into new Draw pile
- [ ] Discard pile becomes empty

When fewer than 4 remain:

- [ ] Face-up Monsters do not rotate
- [ ] Player discard pile is shuffled into new Draw pile
- [ ] Discard pile becomes empty

Always:

- [ ] All 24 player-card instances remain accounted for across legal zones
- [ ] Removed Ultimate Weapon is accounted for during Sudden Death

---

## Scoring

- [ ] 1-point Monsters contribute 1
- [ ] 2-point Monsters contribute 2
- [ ] 3-point Monsters contribute 3
- [ ] Total score matches defeated pile
- [ ] Higher score wins when regular Monsters are exhausted
- [ ] Equal highest score triggers Sudden Death
- [ ] Score calculation works with a non-core legal Monster point distribution

---

## Sudden Death Setup

- [ ] Infinity Beast becomes active for the core set
- [ ] Point value represented as `infinity`
- [ ] Hand limit changes to 4
- [ ] Players above 4 must discard down
- [ ] Ultimate Weapon is removed
- [ ] Black Hole is therefore unavailable
- [ ] Required Weapons are Grenade + Sword + Gun
- [ ] Action Phase remains available

---

## Sudden Death Actions

- [ ] Action cards continue to work
- [ ] Multiple Actions may be chained
- [ ] Newly received Action may be played immediately
- [ ] Draw Action resolves full draw before discarding to 4
- [ ] Player resumes Action Phase after forced discard
- [ ] Skip behavior still ends the turn immediately

---

## Sudden Death Victory

- [ ] Missing Infinity Beast requirement fails
- [ ] Correct requirement succeeds
- [ ] Required cards are discarded
- [ ] Successful defeat immediately sets winner
- [ ] No numeric points are added
- [ ] Game enters game-over state

---

## Solo Computer Controller

- [ ] Computer chooses only actions currently accepted by the rules engine
- [ ] Computer plays a legal Draw Action through the normal action API
- [ ] Computer re-evaluates and can chain a newly drawn Action
- [ ] Computer prefers the highest-point normally beatable Monster
- [ ] Equal-value choices use deterministic tie-breaking
- [ ] Computer prefers a normal Weapon defeat over spending the Ultimate Weapon
- [ ] Computer uses the Ultimate Weapon on the highest-point eligible regular Monster when no normal defeat exists
- [ ] Computer skips when it has no better legal action
- [ ] Computer strategy does not mutate its input state

---

## Player Views and Privacy

- [ ] Solo UI does not render the computer's card faces
- [ ] Solo UI shows the computer hand count or card backs
- [ ] A player-view selector contains only the requesting player's private hand
- [ ] An Online Table player view exposes the opponent hand count, not opponent card identities
- [ ] Hidden cards are omitted from serialized client data rather than merely hidden with CSS

---

## Online Table Skeleton

- [ ] Product-facing copy consistently uses `Table`, not `Room`
- [ ] Create, join, waiting, disconnected, and error states are representable
- [ ] Table codes use a documented, normalized format
- [ ] Creating a Table returns a unique short code and one authenticated seat
- [ ] A second player can join and starts the game; a third is rejected
- [ ] Invalid and missing Table codes fail safely
- [ ] Only a Table member may read state or submit actions
- [ ] A submitted action's player ID must match the authenticated seat
- [ ] Only the current player may submit normal turn actions
- [ ] Illegal actions are rejected by the in-memory authoritative service
- [ ] Accepted actions are applied through the shared engine and validated before commit
- [ ] Separate in-memory Tables never share state
- [ ] Each serialized view omits every opponent-hand instance ID
- [ ] The Table boundary accepts actions, never a client-authored `GameState`
- [ ] Network contracts remain separate from React and the rules engine
- [ ] The disconnected skeleton clearly says live online play is not configured
- [ ] The UI does not imply that the in-memory service is deployed or cross-device

The following checks belong to the later transport/persistence milestone and must pass before Online Table is described as playable:

- [ ] Accepted actions synchronize both clients
- [ ] Stale or simultaneous actions cannot both commit
- [ ] Reconnect recovers the same seat without duplicating a participant
- [ ] Expired Tables and process restarts follow the documented persistence policy
- [ ] Neither client payload contains the opponent's private hand

---

## Persistence

- [ ] Game state serializes to JSON
- [ ] Serialized state restores correctly
- [ ] Current phase restores correctly
- [ ] Action Phase availability restores correctly
- [ ] Hands restore correctly
- [ ] Deck orders restore correctly
- [ ] Defeated piles restore correctly
- [ ] Removed-from-game Ultimate Weapon restores correctly
- [ ] Sudden Death state restores correctly
- [ ] Schema version is validated
- [ ] Unknown or missing card-definition IDs fail safely

---

## Rules Sandbox

- [ ] Every documented legal preset passes `validateGameState()`
- [ ] Action-chain and Action-timing-lock presets exercise the real engine
- [ ] Recycle presets cover both Monster-rotation branches
- [ ] Tie and Sudden Death presets derive legal state rather than faking scores
- [ ] Alternate-distribution preset uses 17 Monsters without requiring the core point split

---

## UI and Accessibility

- [ ] Every game action is keyboard operable through a semantic control
- [ ] Focus is visible and dialogs/trays manage focus correctly
- [ ] Card availability is not communicated by color alone
- [ ] Card images have useful accessible names
- [ ] Important turn, draw, discard, and result changes are announced appropriately
- [ ] Reduced-motion preference is respected
- [ ] Disabled actions explain why they are unavailable where practical
- [ ] Narrow screens do not hide required controls

The current complete-card JPGs should be tested as image-backed controls. Layered card composition is not required until separate frame, artwork, icon, and text assets exist.
