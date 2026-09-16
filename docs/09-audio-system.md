# Audio system

> **Status:** Implemented runtime architecture and extension guide

## Architecture

All sound is routed through the shared `AudioManager`. Components may select a scene or report authoritative game state, but they must not construct `Audio`, `Howl`, or browser audio nodes directly.

```text
AudioProvider (preference, initial playback attempt, gesture fallback, visibility)
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
| Normal match | `tavern-ambience.mp3` | Two-voice loop with a 12-second crossfade |
| Sudden Death | `battle-for-eternity.mp3` | Two-voice loop with a 5-second crossfade |
| Local victory | `dubs-in-the-chat.mp3` | Plays once |
| Local loss | `take-the-l.mp3` | Plays once |
| Monster defeated | `monster-defeated.mp3` | Event-driven SFX |
| Card interaction | `card-1.mp3` through `card-4.mp3` | Random variant without an immediate repeat |
| Initial or recycled deck shuffle | `shuffle-cards.mp3` | One cue per authoritative shuffle event batch |

Scene changes fade between long-form tracks over 1.2 seconds. Disabling sound immediately stops SFX and fades long-form audio over 0.32 seconds; enabling it resumes the scene that the application currently wants.

For crossfade loops, the alternate player is loaded when the scene starts. The manager uses the earlier of the browser-reported duration and the measured manifest duration, starts the alternate player before the overlap, and waits for its `play` event before fading the current player. The tavern file's measured decoded duration is 52.632 seconds.

## Authoritative event mapping

`useGameAudio` passes `GameState` to the manager. `getGameAudioScene` derives the active long-form scene from match mode, phase, winner, and local player. `getGameAudioCues` maps durable game events to SFX. The event cursor tracks event IDs so repeated Online Table snapshots do not replay sounds.

- A fresh game state selects normal ambience; its sole `game-started` event emits one shuffle cue for the initial player and Monster deck shuffles.
- `draw-deck-recycled` emits a shuffle cue. A paired `monsters-rotated` marker remains in the same event batch and does not create a second sound.
- `action-played`, `cards-drawn`, `card-discarded`, and `ultimate-used` emit one randomized card cue per event.
- `monster-defeated` emits the defeat cue. A Sudden Death `game-won` event also emits it for the Infinity Beast.
- `sudden-death-started` is reflected by `state.mode`, which selects Sudden Death music; `phase`, `winnerId`, and the local player select victory or loss.

Audio remains presentation-only. It never changes `GameState`, affects legal actions, or adds audio rules to the engine.

## Preference and browser lifecycle

Sound defaults on. The fixed sound button exposes its state with `aria-pressed` and persists it under `monster-mania:audio-enabled:v1`. The preference is restored before any playback attempt.

`AudioProvider` attempts to start the menu scene as soon as the boot screen hands off to the application. Browsers may still block audible playback until a real pointer or keyboard gesture; the provider listens for that first gesture and resumes Howler without bypassing the browser policy. Playback errors may retry after Howler's unlock event only while the same sound is still active. Returning to a visible tab resumes the shared audio context; it does not duplicate tracks.

## Loading and caching

Short SFX are in the blocking critical tier. Menu music and match ambience warm after the menu appears. Sudden Death and result music warm later and are skipped on Save-Data and 2G connections. Long tracks use HTML5 streaming so playback can begin without decoding an entire multi-megabyte file into memory.

The production Workbox service worker uses a dedicated Cache First audio cache with bounded expiration and byte-range request support. MP3 files are intentionally excluded from the precache manifest. A waiting worker presents a visible update notice instead of reloading an active match; the player chooses when to activate it.

When replacing an audio file at the same public path, bump `GAME_ASSET_VERSION` in `src/game/assets/assetVersion.ts`. The version query produces a fresh runtime-cache key. Old entries are removed through cache expiration and quota-aware cleanup.

## Extending or tuning audio

1. Add the file under `public/assets/audio/`.
2. Add one typed entry to `AUDIO_MANIFEST`, including its bus, preload tier, loop mode, and relative volume.
3. If it represents a new semantic cue, add the typed ID and one manager method or event mapping. Keep components free of file paths.
4. Add or update unit tests for disabled playback, transitions, event dedupe, or variant behavior.
5. Bump `GAME_ASSET_VERSION` when replacing an existing path, then build and verify the generated worker's audio route.

Tune overall mix with `AUDIO_MASTER_VOLUME` and `AUDIO_BUS_VOLUMES`; tune an individual track with its manifest `volume`. Crossfade lengths belong on the relevant manifest entries.
