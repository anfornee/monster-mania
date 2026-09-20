# Audio system

> **Status:** Implemented runtime architecture and extension guide

## Architecture

All sound is routed through the shared `AudioManager`. Components may select a scene or report authoritative game state, but they must not construct `Audio`, `Howl`, or browser audio nodes directly.

```text
SettingsProvider (versioned application preferences)
    -> AudioProvider (initial playback attempt, gesture fallback, visibility)
    -> AudioManager (scene transitions, event dedupe, fades, variants)
        -> music / ambience / SFX buses
            -> Howler playback backend
                -> streamed HTML5 audio for long tracks
                -> Web Audio for short effects
```

`src/game/audio/audioManifest.ts` is the source of truth for file paths, buses, relative volume, preload tier, loop behavior, and approximate duration. Paths use `GAME_ASSET_VERSION`, just like visible assets. `AudioManager` exposes semantic commands such as `playMenuMusic()`, `startGameAmbience()`, `startSuddenDeathMusic()`, `playVictoryMusic()`, `playLossMusic()`, and the SFX helpers.

## Track behavior

| Scene or cue | File | Behavior |
| --- | --- | --- |
| Tavern menu | `welcome-hunter.mp3` | Native seamless loop |
| Normal match ambience | `tavern-ambience.mp3` | Two-voice loop with a 12-second crossfade |
| Normal match music | `tavern-music-1.mp3` through `tavern-music-4.mp3` | Sequential playlist layered over the ambience |
| Sudden Death | `battle-for-eternity.mp3` | Two-voice loop with a 5-second crossfade |
| Local victory | `dubs-in-the-chat.mp3` | Plays once |
| Local loss | `take-the-l.mp3` | Plays once |
| Monster defeated | `monster-defeated.mp3` | Event-driven SFX |
| Card interaction | `card-1.mp3` through `card-4.mp3` | Random variant without an immediate repeat |
| Initial or recycled deck shuffle | `shuffle-cards.mp3` | One cue per authoritative shuffle event batch |

Scene changes use a queued 1.2-second handoff: every outgoing long-form layer fades completely and stops before the latest requested scene begins fading in. Rapid scene requests collapse to the most recent intent, so navigation cannot leave competing menu and gameplay tracks alive. Normal gameplay runs the tavern music playlist and tavern ambience together; entering Sudden Death or a game result fades out both before the dedicated music takes over. Master mute suppresses new SFX and fades long-form output to zero over 0.32 seconds without stopping its transport. Long tracks and silent scene changes continue underneath the mute, so unmuting ramps the current scene back to its saved bus levels without reloading or restarting it.

Return-to-Tavern controls prime the menu source at zero volume inside the initiating user gesture. This preserves mobile browser playback permission while the gameplay layers finish their fade; the prepared menu voice becomes audible only after the handoff completes.

For crossfade loops, the alternate player is loaded when the scene starts. The manager uses the earlier of the browser-reported duration and the manifest duration, starts the alternate player before the overlap, and waits for its `play` event before fading the current player. The current tavern ambience is approximately 21 seconds long; the menu track is approximately 2 minutes 32 seconds. The first tavern music track is priority-warmed and the remaining playlist tracks warm in the background.

## Authoritative event mapping

`useGameAudio` passes `GameState` to the manager. `getGameAudioScene` derives the active long-form scene from match mode, phase, winner, and local player. `getGameAudioCues` maps durable game events to SFX. The event cursor tracks event IDs so repeated Online Table snapshots do not replay sounds.

- A fresh game state selects normal ambience; its sole `game-started` event emits one shuffle cue for the initial player and Monster deck shuffles.
- `draw-deck-recycled` emits a shuffle cue. A paired `monsters-rotated` marker remains in the same event batch and does not create a second sound.
- `action-played`, `cards-drawn`, `card-discarded`, and `ultimate-used` emit one randomized card cue per event.
- `monster-defeated` emits the defeat cue. A Sudden Death `game-won` event also emits it for the Infinity Beast.
- `sudden-death-started` is reflected by `state.mode`, which selects Sudden Death music. Victory or loss additionally requires the result presentation to be visible, so the final defeat SFX and blocking Monster Defeated announcement complete before result music is requested.

Audio remains presentation-only. It never changes `GameState`, affects legal actions, or adds audio rules to the engine.

## Settings persistence and browser lifecycle

Application settings are owned by `SettingsProvider`, consumed by the audio system, and persisted as a versioned object under `monster-mania:settings:v1`. Version 1 stores master mute plus relative `music`, `ambience`, and `sfx` values. Sound defaults on and each bus defaults to `1` (100% of the authored manifest level). Storage parsing validates the version, types, finiteness, and range; malformed or unsupported values fall back safely.

The top-bar gear opens the same Settings panel from the menu, Solo play, and Online Table flow. The fixed speaker remains the quick master-mute control, and both surfaces update the same master-mute value. Muting never overwrites bus values or stops long-form playback, so unmuting restores the previous mix at its current playback position. On the first load after upgrading, a legacy `monster-mania:audio-enabled:v1` value of `false` is translated to master mute. Once versioned settings exist, they are authoritative.

Slider presentation updates immediately while pointer and keyboard changes are coalesced over a short 100 ms window before updating application audio state. Browser storage writes are separately debounced by 250 ms and flushed on `pagehide`; persistence is never the trigger for live playback changes.

`AudioProvider` attempts to start the menu scene as soon as the boot screen hands off to the application. Browsers may still block audible playback until a real pointer or keyboard gesture; the provider listens for that first gesture and resumes Howler without bypassing the browser policy. Playback errors may retry after Howler's unlock event only while the same sound is still active and not visibility-paused.

The provider owns one document `visibilitychange` listener. Hiding the document abandons one-shot SFX, pauses active long-form voices, and cancels an in-progress handoff without starting its destination. Returning to a visible document resumes the current logical scene, or starts the latest desired scene when application state changed while hidden. Crossfade scheduling is re-armed without creating another logical track.

## Bus volumes

Every manifest entry belongs to `music`, `ambience`, or `sfx`. `AudioManager` receives the persisted relative value for each bus and exposes typed getters/setters for live updates. Effective output is `manifest volume × clamped bus volume`; a bus value is always clamped to `0...1`, so user preference can never amplify an asset above its authored manifest ceiling. Existing and future sounds both pick up the current bus value. Active long-form tracks ramp briefly to a changed value without restarting, while SFX volume updates apply to the shared players immediately.

Lifecycle fades and user mix changes share a playback voice but not a timing policy. Each voice records its current fade envelope and deadline. If a bus changes during a menu/game handoff or loop crossfade, the manager retargets that existing envelope to the new effective volume for its remaining duration instead of starting a competing fade. A newly started voice consults the current bus value before its first audible fade, including when that bus is at zero.

The menu's native HTML5 loop may briefly report a non-playing state while recovering from browser autoplay lock. Bus changes still write its current target volume during that interval, ensuring the recovered menu voice cannot resume at a stale Music level.

Bus ownership is semantic: menu, gameplay, Sudden Death, victory, and loss tracks use `music`; environmental and crowd beds use `ambience`; card, shuffle, Monster-defeat, and other short gameplay cues use `sfx`. Do not duplicate user volume in manifest entries or UI code.

## Loading and caching

Short SFX are in the blocking critical tier. Menu music and match ambience warm after the menu appears. Sudden Death and result music warm later and are skipped on Save-Data and 2G connections. Long tracks use HTML5 streaming so playback can begin without decoding an entire multi-megabyte file into memory.

The production Workbox service worker uses a dedicated Cache First audio cache with bounded expiration and byte-range request support. MP3 files are intentionally excluded from the precache manifest. A waiting worker presents a visible update notice instead of reloading an active match; the player chooses when to activate it.

When replacing an audio file at the same public path, bump `GAME_ASSET_VERSION` in `src/game/assets/assetVersion.ts`. The version query produces a fresh runtime-cache key. Old entries are removed through cache expiration and quota-aware cleanup.

## Extending or tuning audio

1. Add the file under `public/assets/audio/`.
2. Add one typed entry to `AUDIO_MANIFEST`, including its semantic bus, preload tier, loop mode, and authored maximum volume.
3. If it represents a new semantic cue, add the typed ID and one manager method or event mapping. Keep components free of file paths.
4. Add or update unit tests for disabled playback, transitions, event dedupe, or variant behavior.
5. Bump `GAME_ASSET_VERSION` when replacing an existing path, then build and verify the generated worker's audio route.

Tune an individual authored maximum with its manifest `volume`. User-facing relative mix belongs in versioned application settings, flows through `AudioProvider` to the manager's bus values, and must remain within `0...1`. Components must never locate playback objects or multiply per-file levels themselves. Crossfade lengths belong on the relevant manifest entries.
