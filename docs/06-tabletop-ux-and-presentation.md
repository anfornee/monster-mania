# Tabletop UX and presentation

> **Status:** Current implementation guide for the Solo Game presentation layer

The Solo Game is presented as two seats around a shared tavern table. This layer renders authoritative `GameState` and dispatches ordinary `GameAction`s; it does not own or duplicate gameplay rules.

## Board composition

- The opponent seat is at the top with identity, score, defeated pile, a face-down hand, and the shared draw deck.
- Face-up Monsters occupy the central arena. Their requirement chips show both the required Weapon name and a check/dash state, so availability is not communicated by color alone.
- The local seat is at the bottom with a large hand, integrated score/defeated pile, shared deck, and turn control.
- The latest event remains visible. Full recent history is available from the compact Hunter's journal.
- `PlayerState` and neutral seat language remain controller-agnostic so a future Online Table can reuse the composition without pretending every opponent is a bot.

The production table art is `public/assets/backgrounds/board-bg.png`. Its built-in dagger, candle, cup, journal, and wear are decorative and therefore are not exposed to assistive technology.

## Card interaction

Selecting a hand card opens a reusable `CardInspector`. A playable Action exposes a separate **Play card** action; an unavailable card remains inspectable without presenting a misleading play control. Selecting a Monster inspects its high-resolution source card. Opponent card faces are never passed to the visual hand stack.

The inspector uses a native modal dialog, supports Escape, starts focus on a close control, and restores focus to the invoking control. Forced discard is the intentional exception: cards become direct toggle controls because selection itself is the pending game action.

Normal player and Monster cards use shared sizing tokens in `src/App.css`. The expanded view always uses the original catalog asset path and preserves the 5:7 card aspect ratio.

## AI pacing and presentation events

The application asks the deterministic strategy for one action at a time. Each result is applied through `applyGameAction`, validated in development, rendered, and followed by a short centralized delay before the next decision. Timing constants live in `src/game/presentation/aiPacing.ts`.

React effects own the timers and cancel them when state changes or the component unmounts. Starting or leaving a game therefore cannot leave an old whole-turn callback mutating a later match. Controls are locked while the computer owns the decision or during the brief handoff beat.

Presentation-only movement is driven by mounting/unmounting visual cards after authoritative state changes. New hand cards deal into place, new Monsters enter the arena, and opponent card backs visibly change count. The rules state is never delayed to wait for CSS.

Major events are derived from new `GameEvent`s by `src/game/presentation/announcements.ts`. `GameAnnouncement` currently handles Monster defeat and Sudden Death. It uses a polite live region without duplicating every routine journal entry.

## Player identity and match lifecycle

Before a new Solo Game, the player enters a trimmed 2–24 character display name. The normalized value is stored under `monster-mania:player-name:v1` and is used by engine-created narration, avoiding broken third-person messages such as “You takes”. Direct interface labels may still say “Your hand” and “Your turn.”

A completed game is removed from resumable storage. The result dialog reports the winner, final scores, and defeated totals, then offers **Play again** and **Return to menu**. Play again creates a fresh seeded state and clears transient presentation state. Return to menu drops the completed in-memory match.

## Menu environment and assets

The menu uses `public/assets/backgrounds/menu-bg.png`, with controls placed in the illustration's left-side negative space. The board uses `public/assets/backgrounds/board-bg.png`. Replace these files at the same paths to revise the environments without changing components or CSS.

The current cards remain flattened, complete-card JPGs. Inspection improves their legibility but does not make the card typography or icon layers data-driven.

## Accessibility and motion

- Cards and Monsters are semantic buttons with visible keyboard focus.
- Dialogs support Escape and focus restoration.
- Opponent hands expose only a count and decorative card backs.
- Requirement readiness uses symbols and text as well as color.
- Important phase changes use a restrained live announcement.
- `prefers-reduced-motion: reduce` collapses all dealing, hover, and announcement animation durations while leaving every action available.

## Test strategy

Pure tests cover name normalization/storage, resumability, pacing constants, and announcement selection. Server-rendered component tests verify opponent privacy, playable versus inspect-only labels, and match-result destinations. Engine simulation remains responsible for full deterministic match correctness; visual verification should use the browser at representative desktop and narrow widths rather than pixel snapshots.
