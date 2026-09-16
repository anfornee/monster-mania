# Asset loading and cache strategy

> **Status:** Current startup, audio warming, and browser-cache behavior

## Boot flow

The React root renders `GameBootScreen` before the application UI mounts. The boot screen requests and decodes the critical menu images and fetches the short SFX tier, reports progress from completed attempts, and then reveals the menu beneath a short fade. A 360 ms minimum presentation avoids a one-frame 0% to 100% flash on a warm visit without imposing a multi-second artificial delay.

After the menu is visible, gameplay artwork and priority audio begin warming during `requestIdleCallback` when available, with a zero-delay fallback. Optional long-form audio warms 15 seconds later unless Save-Data or a 2G connection is active.

```text
boot screen
    -> logo + menu background decode; short SFX fetch
    -> menu fades in
    -> board, card art, menu music, and match ambience warm
    -> optional Sudden Death and result music warm later
```

Long-form audio is never part of the blocking boot percentage.

## Authoritative manifest and groups

`src/game/assets/assetManifest.ts` is the runtime loading manifest. Image entries use these groups:

- `boot`: the logo used by the loader itself.
- `menu`: the tavern exterior required before revealing the menu.
- `game`: the board background, card back, and all player and Monster art.

Audio definitions live in `src/game/audio/audioManifest.ts` and are projected into the asset manifest as:

- `critical`: six short SFX fetched before the menu appears.
- `priority`: menu music and normal-match ambience warmed after reveal.
- `background`: Sudden Death and result music warmed later when the connection permits.

Card entries are derived from `CORE_CATALOG`; do not manually duplicate the card list. Adding a catalog card with an `assetPath` automatically places it in the gameplay tier. Add a standalone decorative image once to `GAME_ASSETS` and reference its exported path from components. Add audio only through `AUDIO_MANIFEST`.

Favicons and installed-app icons remain controlled by `index.html` and `public/manifest.json`. They are not counted as game-visible boot work.

## Loader behavior

`preloadAssets.ts`:

- deduplicates identical URLs;
- shares in-flight and successful requests across React Strict Mode, boot, and background warming;
- limits concurrency, with audio tiers intentionally warmed one file at a time;
- waits for image load and attempts `decode()` before counting an image complete;
- consumes the complete response body when explicitly warming audio;
- records both critical and non-critical failures; and
- times out an individual request after 30 seconds instead of hanging forever.

A failed critical asset keeps the boot screen visible with a player-safe Retry action. Failed requests are removed from the shared request map, so Retry performs real work. Non-critical gameplay or audio failures are logged and never block the menu.

Howler uses streamed HTML5 audio for long tracks and Web Audio for short SFX. The explicit warming layer and playback layer share the same versioned URLs and browser/service-worker cache instead of maintaining a second asset list. See `docs/09-audio-system.md` for playback behavior.

## Browser caching and invalidation

A Workbox service worker generated during the production build precaches the application shell for resilient repeat visits and offline Solo access. MP3 files are excluded from that precache. Runtime routes are ordered as follows:

1. `/assets/audio/` uses a dedicated Cache First cache with range-request support, 24-entry maximum, 90-day expiration, and quota-aware purging.
2. Game-visible artwork uses its own Cache First cache with bounded expiration.
3. Firebase configuration, Auth, Firestore, and Callable Function traffic is Network Only. The worker never caches Online Table data or API responses.

Versioned asset query strings remain part of runtime-cache keys. Public assets keep stable filenames, so every game-visible image and audio URL receives the query version from `src/game/assets/assetVersion.ts`. **Bump `GAME_ASSET_VERSION` whenever an existing public image or audio file is replaced in place.** New files naturally have new paths. Expiration and quota-aware purging retire old runtime entries safely.

Updated workers use the normal waiting lifecycle instead of automatically reloading an active match. `registerServiceWorker.ts` checks at startup, hourly, and when a hidden page becomes visible. When an update finishes installing, `AppUpdateNotice` offers an explicit **Update now** action; accepting tells the waiting worker to activate and reloads through the registration helper. Obsolete precache entries are cleaned during activation.

Firebase Hosting serves `sw.js` and `manifest.json` with `Cache-Control: no-cache` so installed clients check for updates without caching update metadata. Production hosting should serve HTML with revalidation and may give versioned runtime assets a long cache lifetime. Vite-hashed JS/CSS bundles already change URL after each build. The static `/manifest.json` remains the only web app manifest.

## Accessibility and reduced motion

The visible percentage updates with actual completed asset attempts. A separate polite status announces only milestone phrases rather than every percentage. Critical failures use an alert and keyboard-operable Retry button.

The logo breathes using only transform and opacity. The global `prefers-reduced-motion: reduce` rule collapses the pulse, progress transition, boot fade, and menu reveal to effectively instant behavior. Audio fades are not motion and remain enabled; the persistent sound control can silence all buses.

## Testing

### Measured inventory

The image baseline is 31 files / 31.98 MiB. Audio adds six short files / about 0.23 MiB and five long files / about 24.98 MiB, for 42 game-visible files / about 57.20 MiB total. Only the two menu images plus six short SFX are blocking: eight files / about 4.43 MiB. The much larger long-form tier remains non-blocking and streams during playback.

Run the standard project checks and verify the following in a real browser:

1. Clear site cache and reload: the dark boot surface appears before the menu and reaches 100% only after the two critical images and six SFX complete.
2. Reload normally: critical requests come from browser or service-worker cache and readiness is much faster.
3. Throttle the Network panel: progress remains tied to completed requests; long music does not block reveal.
4. Temporarily break a gameplay or non-critical audio path: the menu still appears and the failure is logged.
5. Temporarily break a critical path: the Retry state appears within the request timeout.
6. Enable reduced motion: the logo does not visibly pulse and visual transitions are effectively instant.
7. Build and serve production, load once, then disable the network: the cached menu, gallery, Solo shell, and already warmed audio remain available while Online Table operations report network failure.
8. Inspect audio requests in production: byte-range responses work and audio uses `monster-mania-audio`, not the precache or artwork cache.
9. Deploy a changed build while a match is open: the client does not reload automatically; the update notice appears and activation occurs only after **Update now** is chosen.
10. Replace a file at the same path and bump `GAME_ASSET_VERSION`: the new query URL downloads once and subsequent requests hit the new cache entry.

Unit tests cover progress calculation, response-body completion, decode waiting, duplicate URLs, critical/non-critical failure classification, retry, manifest derivation, audio preference, disabled playback, scene transitions, randomized variants, and authoritative-event dedupe.
