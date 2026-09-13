# Deployment

Monster Mania is a Vite application hosted with Firebase Hosting. Firebase Anonymous Auth and Cloud Firestore also back the Online Table membership lobby. GitHub Actions verifies the app and Firestore rules, creates Hosting previews for pull requests, and updates the live site after changes reach `main`.

## Hosting configuration

- **Firebase project:** `monster-mania-aea35`
- **Build output:** `dist/`
- **Hosting config:** `firebase.json`
- **Project alias:** `.firebaserc`
- **Application routing:** every unmatched path is rewritten to `/index.html`, so browser navigation and routes such as `/dev/rules` work after a refresh.

The repository has no trusted gameplay runtime yet. Files in `public/` are copied into the production bundle by Vite and served by Firebase with their same public paths. Firebase Web SDK values are public client identifiers and are loaded from `VITE_FIREBASE_*` variables locally or Firebase Hosting's `/__/firebase/init.json`; never use a service-account credential in the browser bundle.

## Automated deployments

Both deployment workflows install from the lockfile and require the same verification command to succeed:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run test:firestore
npm run build
```

The workflows select Node 22 from `.nvmrc` and Temurin JDK 21 so Firebase Emulator Suite behavior is consistent across developer machines and CI.

The commands appear as one build step in GitHub Actions. If any command fails, Firebase deployment does not run.

### Pull request previews

`.github/workflows/firebase-hosting-pull-request.yml` runs for pull requests. In the normal repository flow, these are pull requests targeting `main`.

After a successful build, Firebase creates or updates a temporary preview channel and reports its URL on the pull request. The workflow intentionally skips pull requests from forks because repository secrets are not exposed to forked workflows.

The workflow currently listens to pull requests against any base branch. Add a `branches: [main]` filter under `pull_request` if previews should be limited strictly to pull requests targeting `main`.

### Live deployment

`.github/workflows/firebase-hosting-merge.yml` runs on every push to `main`, including a merged pull request. After the verification commands pass, it authenticates with the existing Firebase service-account secret, deploys repository-managed Firestore rules and indexes, and then deploys the `dist/` bundle to Firebase's `live` Hosting channel. A failed Firestore deployment prevents the Hosting release so the client and its required access policy cannot drift apart.

The expected public Firebase URL is:

```text
https://monster-mania-aea35.web.app
```

Firebase may also expose the equivalent `firebaseapp.com` hostname or a configured custom domain.

## GitHub repository setup

The workflows depend on:

- the built-in `GITHUB_TOKEN`, used to report deployment status and preview details;
- the repository secret `FIREBASE_SERVICE_ACCOUNT_MONSTER_MANIA_AEA35`, used to authenticate Firebase Hosting deployments.

Do not commit the service-account JSON or copy its value into documentation. If the Firebase project is reconnected to GitHub, confirm that the generated secret name still matches both workflow files.

The service account also needs permission to create/release Firebase Rules rulesets and manage Firestore indexes. If the new infrastructure step reports an IAM denial, grant that deployment identity Firebase Rules Admin and Cloud Datastore Index Admin access in project `monster-mania-aea35`; do not broaden the browser application's permissions or place this credential in a `VITE_*` variable.

## Local production check

Run the same checks before opening or merging a pull request:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run test:firestore
npm run build
npm run preview
```

Open the URL printed by Vite and verify at least:

- the landing page loads without missing artwork;
- a Solo Game starts and can be resumed;
- `/dev/rules` loads directly and survives a browser refresh;
- the browser console has no asset or manifest errors.

## Firestore configuration and deployment

The repository owns `firestore.rules`, `firestore.indexes.json`, and their `firebase.json` entries. The initial lobby requires no composite indexes. Run security tests before deploying either file:

```bash
nvm install
nvm use
npm ci
npm run test:firestore
npx firebase-tools deploy --only firestore:rules,firestore:indexes --project monster-mania-aea35
```

The emulator requires JDK 21 or newer. Anonymous Authentication is enabled through Firebase Console. Firebase CLI 15.30.0 does not support Authentication provider declarations in `firebase.json`, so there is no repository-side Auth provider deployment command. Do not add an unsupported `auth` block to that file.

App Check enforcement is intentionally deferred until online gameplay is functional and verified. See [Firebase Online Table lobby foundation](08-firebase-online-lobby.md).

## Manual Hosting deployment

Automated GitHub deployment is the normal release path. If a manual deployment is required, install and authenticate the Firebase CLI, build the exact commit to release, and deploy only Hosting:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run test:firestore
npm run build
firebase deploy --only hosting --project monster-mania-aea35
```

Use manual live deployment deliberately: it can publish code that has not passed through the repository's pull-request history.

## Static assets and caching

Firebase serves the files emitted into `dist/`. Vite fingerprints imported JavaScript and CSS bundles, while files copied from `public/` keep stable names. The game appends its own asset version to preloaded game-art requests; when replacing an image at the same public path, bump `GAME_ASSET_VERSION` in `src/game/assets/assetVersion.ts` as described in [Asset loading and cache strategy](07-asset-loading-and-cache-strategy.md).

There are currently no custom Firebase `Cache-Control` headers and no service worker. Add either only as an intentional cache-policy change and test both fresh loads and upgrades from a previously deployed version.

## Troubleshooting

- **The PR job is skipped:** confirm the pull request branch belongs to this repository rather than a fork.
- **Authentication fails:** confirm `FIREBASE_SERVICE_ACCOUNT_MONSTER_MANIA_AEA35` exists in GitHub Actions secrets and belongs to the configured Firebase project.
- **The deploy step never starts:** inspect the preceding build step; type checking, linting, tests, and bundling must all pass.
- **A refreshed route returns the app but renders incorrectly:** Firebase's SPA rewrite is active, so check the client-side route and browser console.
- **Artwork looks stale:** confirm the replacement asset was committed and `GAME_ASSET_VERSION` was bumped when the public path stayed the same.
