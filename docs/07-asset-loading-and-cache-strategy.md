# Asset loading and cache strategy

> **Status:** Current startup and browser-cache behavior

## Boot flow

The React root renders `GameBootScreen` before the application UI mounts. The boot screen requests and decodes the critical menu tier, reports progress from completed attempts, and then reveals the menu beneath a short fade. A 360 ms minimum presentation avoids a one-frame 0% → 100% flash on a warm visit without imposing a multi-second artificial delay.

After the menu is visible, the gameplay tier begins during `requestIdleCallback` when available, with a zero-delay fallback. The board and card catalog should therefore already be warm when Solo Game begins.

```text
boot screen
    ↓
logo + menu background load and decode
    ↓
menu fades in
    ↓
board, card back, and catalog art preload in the background
```

## Authoritative manifest and groups

`src/game/assets/assetManifest.ts` is the single runtime manifest.

- `boot`: the logo used by the loader itself.
- `menu`: the tavern exterior required before revealing the menu.
- `game`: the board background, card back, and all player/Monster art.

Card entries are derived from `CORE_CATALOG`; do not manually duplicate the card list. When adding a catalog card with an `assetPath`, it automatically joins the gameplay preload tier. Add a standalone decorative image once to `GAME_ASSETS` and reference its exported path from components.

Favicons and installed-app icons remain controlled by `index.html` and `public/manifest.json`. They are not counted as game-visible boot work.

## Loader behavior

`preloadAssets.ts`:

- deduplicates identical URLs;
- shares in-flight and successful image requests across React Strict Mode, boot, and background warming;
- loads no more than six images concurrently;
- waits for image load and attempts `decode()` before counting completion;
- records both critical and non-critical failures;
- times out an individual request after 30 seconds instead of hanging forever.

A failed critical menu asset keeps the boot screen visible with a player-safe Retry action. Failed requests are removed from the shared request map, so Retry performs real work. Non-critical gameplay failures are logged and never block the menu.

## Browser caching and invalidation

A Workbox service worker generated during the production build precaches the application shell for resilient repeat visits and offline Solo access. Game-visible artwork enters a dedicated runtime cache as the existing manifest-driven preloader fetches it; versioned asset query strings remain part of each cache key. Firebase configuration, Auth, Firestore, and Callable Function traffic is explicitly network-only; the worker never caches Online Table data or API responses.

Updated workers use the normal waiting lifecycle instead of forcing control or reloading an active match. Once all pages using the previous worker close, the new worker activates and removes obsolete precache entries. Firebase Hosting serves `sw.js` and `manifest.json` with `Cache-Control: no-cache` so installed clients check for updates without caching the update metadata itself.

Public assets keep stable filenames, so every game-visible URL receives the query version from `src/game/assets/assetVersion.ts`. **Bump `GAME_ASSET_VERSION` whenever an existing public image is replaced in place.** That produces a new request URL without editing components or card definitions. New files naturally have new paths.

Production hosting should serve HTML with revalidation and may give versioned image URLs a long cache lifetime. Vite-hashed JS/CSS bundles already change URL after each build. The static `/manifest.json` remains the only web app manifest; the PWA build plugin generates only the service worker and its revisioned precache manifest.

## Accessibility and reduced motion

The visible percentage updates with actual completed asset attempts. A separate polite status announces only milestone phrases rather than every percentage. Critical failures use an alert and keyboard-operable Retry button.

The logo breathes using only transform and opacity. The existing global `prefers-reduced-motion: reduce` rule collapses the pulse, progress transition, boot fade, and menu reveal to effectively instant behavior.

## Testing

### Measured baseline

The current game-visible inventory is 31 files / 31.98 MiB. The blocking tier is 2 files / 4.20 MiB; the 29-file / 27.78 MiB gameplay tier is non-blocking. In a local production-preview check throttled to roughly 400 KiB/s with 100 ms latency, the loader visibly reached 50% with the decoded logo present and revealed the menu at about 11.6 seconds. The same profile reloaded to the menu in about 0.4 seconds; both critical responses revalidated with no response body transfer. These local figures are a regression baseline, not a promise for every host or device.

Run the standard project checks and verify the following in a real browser:

1. Clear site cache and reload: the dark boot surface appears before the menu and reaches 100% only after the logo and menu background decode.
2. Reload normally: critical requests should be served from memory/disk cache according to host headers and the boot should reach readiness much faster.
3. Throttle the Network panel: progress should remain tied to completed requests.
4. Temporarily break a gameplay asset path: the menu should still appear and the failure should be logged.
5. Temporarily break a critical path: the Retry state should appear within the request timeout.
6. Enable reduced motion: the logo should not visibly pulse and transitions should be effectively instant.
7. Build and serve production, load once, then disable the network: the menu, card gallery, and Solo Game shell should remain available while Online Table operations report network failure.
8. Deploy a changed build while a match is open: the active client must not reload automatically; close all game clients and reopen to activate the updated worker.

Unit tests cover progress calculation, completion counts, decode waiting, duplicate URLs, critical/non-critical failure classification, retry, manifest derivation, and boot-screen status markup.
