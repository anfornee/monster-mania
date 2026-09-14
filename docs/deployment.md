# Deployment

Monster Mania deploys a Vite app, Cloud Firestore Rules/indexes, and 2nd gen Cloud Functions to Firebase project `monster-mania-aea35`. Firebase Anonymous Auth, Firestore, and Callable Functions back Online Tables. Production Hosting serves `dist/`, with an SPA rewrite to `/index.html`.

## Pinned toolchain

Project commands intentionally use Node `22.23.2` from `.nvmrc` and npm `10.9.8` from `packageManager`/`engines`. The Functions runtime is Node 22. `firebase-tools` is pinned to `15.30.0` in the root lockfile; CI invokes infrastructure deployment through `npx --no-install` and gives the Hosting action the same explicit version. A global Firebase CLI is neither required nor used.

The GitHub actions themselves use their current Node-24-compatible releases. That internal action runtime does not change the application's Node 22 runtime:

- `actions/checkout@v7`
- `actions/setup-node@v7`
- `actions/setup-java@v5`
- `google-github-actions/auth@v3`
- `FirebaseExtended/action-hosting-deploy@v0.11.0`

JDK 21 is selected in CI and is required locally for Firebase Emulator Suite tests.

## Reproducible verification

Run from a clean checkout/dependency state:

```bash
nvm install
nvm use
npm ci
npm ci --prefix functions
npm run typecheck
npm run lint
npm test
npm run test:functions
npm run test:firestore
npm run build
```

The root and `functions/` directories intentionally have separate lockfiles. Do not delete either lockfile for normal installation; use `npm ci`. Use `npm install` only when intentionally changing dependencies, then review both manifest and lockfile changes.

## GitHub deployment identity and the Rules 403

The workflows do not contain Workload Identity Federation configuration. Both use the service-account JSON stored in repository secret `FIREBASE_SERVICE_ACCOUNT_MONSTER_MANIA_AEA35`; therefore the authenticated principal is the JSON key's `client_email`. Secret values are intentionally unavailable from a checkout, so its exact email cannot be truthfully derived here. The merge workflow now prints only that non-secret `client_email` as `Authenticated principal:` immediately after authentication. Copy that value from the next Actions run (or inspect the secret JSON locally without committing it) before applying IAM commands.

The failed request was the Firebase CLI's Rules compilation/test operation:

```text
POST firebaserules.googleapis.com/v1/projects/monster-mania-aea35:test
```

Its missing permission is `firebaserules.rulesets.test`. `roles/firebaserules.admin` is the narrow predefined Firebase role covering ruleset test, create, and release operations. The same deploy identity also needs `roles/datastore.indexAdmin` for Firestore indexes and `roles/cloudfunctions.admin` for Functions deployment. Do not grant Project Owner.

An IAM administrator should replace `DEPLOYER_EMAIL` with the workflow-reported principal and run:

```bash
gcloud projects add-iam-policy-binding monster-mania-aea35 \
  --member="serviceAccount:DEPLOYER_EMAIL" \
  --role="roles/firebaserules.admin"
gcloud projects add-iam-policy-binding monster-mania-aea35 \
  --member="serviceAccount:DEPLOYER_EMAIL" \
  --role="roles/datastore.indexAdmin"
gcloud projects add-iam-policy-binding monster-mania-aea35 \
  --member="serviceAccount:DEPLOYER_EMAIL" \
  --role="roles/cloudfunctions.admin"
```

2nd gen deployment also requires the deployer to act as the selected Functions runtime and build service accounts. Grant `roles/iam.serviceAccountUser` on those service accounts, not across the whole project. Determine the project number and default build account, then run the resource-scoped bindings:

```bash
gcloud projects describe monster-mania-aea35 --format="value(projectNumber)"
gcloud builds get-default-service-account --project=monster-mania-aea35

gcloud iam service-accounts add-iam-policy-binding RUNTIME_SERVICE_ACCOUNT \
  --project=monster-mania-aea35 \
  --member="serviceAccount:DEPLOYER_EMAIL" \
  --role="roles/iam.serviceAccountUser"
gcloud iam service-accounts add-iam-policy-binding BUILD_SERVICE_ACCOUNT \
  --project=monster-mania-aea35 \
  --member="serviceAccount:DEPLOYER_EMAIL" \
  --role="roles/iam.serviceAccountUser"
gcloud projects add-iam-policy-binding monster-mania-aea35 \
  --member="serviceAccount:BUILD_SERVICE_ACCOUNT" \
  --role="roles/cloudbuild.builds.builder"
```

For Console-only setup, open Google Cloud Console > IAM & Admin > IAM for `monster-mania-aea35`, locate the workflow-reported principal, and add Firebase Rules Admin, Cloud Datastore Index Admin, and Cloud Functions Admin. Then open IAM & Admin > Service Accounts, grant that principal Service Account User on the runtime and build accounts, and confirm the build account itself has Cloud Build Service Account.

The project/API service agents may require their standard service-agent roles if those were manually removed; do not assign those roles to the GitHub deployer. The deployer may retain its existing Hosting role used by `action-hosting-deploy`.

No IAM change is considered fixed until the merge deployment succeeds and the deployed resources pass the relevant policy and live checks. Do not infer the GitHub deployment principal or its permissions from whichever Google Cloud user is authenticated locally.

## Automated deployment

The pull-request workflow installs both lockfiles and runs all verification, then publishes a Hosting preview for non-fork branches. The merge workflow repeats verification, authenticates, reports the principal, deploys Functions/Rules/indexes together, and only then updates the live Hosting channel. An infrastructure failure prevents the web client from getting ahead of its required backend.

Expected Hosting URL:

```text
https://monster-mania-aea35.web.app
```

Anonymous Authentication remains a one-time Firebase Console setting; Firebase CLI `15.30.0` has no supported `firebase.json` declaration for enabling that provider.

## Browser-callable function invokers

Every 2nd gen `onCall` or `onRequest` function invoked directly by the web app must explicitly declare `invoker: 'public'`. This permits the browser's unauthenticated CORS preflight and request envelope to reach the Firebase Functions callable middleware. It does not bypass application authentication: callable handlers that require a player identity must still reject requests without `request.auth`.

Firestore, Eventarc, scheduled, Pub/Sub, and other background triggers must not be made public. Their Google-managed trigger identity invokes the backing service instead.

Firebase callable functions provide their own CORS handling. If a browser reports an `OPTIONS` response with status `403` and no `Access-Control-Allow-Origin` header, inspect the backing Cloud Run service's invoker policy before adding custom CORS code. That response usually means Google infrastructure rejected the preflight before the function ran.

After adding or redeploying a browser-facing callable, resolve its backing service and inspect its policy:

```bash
gcloud functions describe FUNCTION_NAME --gen2 \
  --region=us-central1 \
  --project=monster-mania-aea35 \
  --format="value(serviceConfig.service)"

gcloud run services get-iam-policy CLOUD_RUN_SERVICE_NAME \
  --region=us-central1 \
  --project=monster-mania-aea35
```

The policy must contain `allUsers` with `roles/run.invoker` for a browser-facing function. Keep `{ invoker: 'public' }` in the function declaration so a later deployment can reproduce the intended policy; do not rely on an undocumented manual binding. Verify one authenticated browser call after deployment, because emulator tests do not reproduce production Cloud Run IAM.

## Manual deployment

Automated deployment is preferred. After all verification passes, an authenticated operator may deploy the exact checked-out commit with the repository-pinned CLI:

```bash
npm ci
npm ci --prefix functions
npm run typecheck
npm run lint
npm test
npm run test:functions
npm run test:firestore
npm run build
npx --no-install firebase deploy --only functions,firestore:rules,firestore:indexes,hosting --project monster-mania-aea35
```

Never place service-account JSON in the browser bundle or a `VITE_*` variable.

## Live Online Table verification

Following a successful deployment, use two separate browser profiles so each gets a different anonymous UID. Verify:

- Host creates a Table and Guest joins by code; a third identity is rejected.
- Exactly one revision-0 match appears, with the same public state for both players.
- Each profile can see its own hand and cannot read the opponent private document.
- Legal Host and Guest actions propagate in both directions; pending controls remain blocked until authority responds.
- Opponent card/discard reveals, Monster defeat announcements, blocking timing, and turn transitions play locally from authoritative events.
- Refresh during an active match restores the same seat, state, and revision without redealing.
- A stale command is rejected and an exact duplicate command does not advance revision twice.
- Play continues through forced discard, Actions, Black Hole, hand limits, final-three/Sudden Death behavior as reached, and a valid winner; both clients agree on final state.

Record the deployed Functions revision and test result. Until this checklist includes a complete live match, Online gameplay is emulator-verified only.

## Static assets and troubleshooting

Vite fingerprints imported JS/CSS. Files copied from `public/` keep stable paths; bump `GAME_ASSET_VERSION` when replacing an image at the same public path. The production build generates `sw.js`, which precaches the application shell and runtime-caches versioned artwork while leaving Firebase traffic network-only. Hosting serves the worker and static manifest with `Cache-Control: no-cache`; confirm those headers after deployment and never add Firebase API endpoints to service-worker caches.

- Rules deployment 403: confirm the printed principal and `roles/firebaserules.admin` binding.
- Index deployment denied: confirm `roles/datastore.indexAdmin`.
- Functions deployment denied: confirm Cloud Functions Admin and resource-scoped Service Account User bindings, plus required APIs.
- Callable request returns an `OPTIONS 403` without CORS headers: confirm that the function is declared with `invoker: 'public'` and that its backing Cloud Run service grants `roles/run.invoker` to `allUsers`.
- Emulator startup fails: confirm JDK 21+ is active.
- Authentication fails: confirm the repository secret exists, is valid JSON, and belongs to this project.
- Artwork looks stale: review the asset-version bump and browser cache.
