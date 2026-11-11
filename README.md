# navo-mobile

Expo (SDK 57, expo-router) app for Navo, one app with content by role (REQUIREMENTS 9.3):
leadership and sales see the overview, contracts and each contract down to its lines, purchase
orders and deliveries (three separate tabs, AC-21). Creating and confirming documents is on the web.

## Run

```sh
cp .env.example .env      # set EXPO_PUBLIC_API_URL for your device
npm install
npx expo start            # press i for the iOS simulator, a for Android, or scan with Expo Go
```

navo-api must be running (`make run` in ../navo-api). Demo sign-in: `lan@congty.vn` (leader) or
`khoa@congty.vn` (sales), password from `make seed`.

## Check

`npm run typecheck && npm run lint && npm test && npm run bundle-check`

## Behaviour worth knowing

- The session token is stored in the device's secure storage and removed at sign-out or on a 401.
- Offline: the last figures stay on screen with an amber banner and the time they were fetched,
  never shown as current (AC-24). Pull down to refresh.
- Numbers come from the API as decimal strings and are formatted without floats (same rules and
  tests as the web app).

## Field notes and verification limits

Quick notes, follow-up tasks and photos are implemented. Drafts are isolated by installation and user; old unowned drafts are quarantined. Photos are copied to durable app storage, and stable note/photo identities allow resumed sends. Successful note content stays immutable while remaining photos resume. Incomplete work autosaves on edits, backgrounding and leaving the screen.

Contract lists paginate, and note selectors fetch all pages. An API failure marks retained values stale even if internet is connected; documents have independent loading/error/retry states. These behaviors have unit/build coverage, not current release-device acceptance. Test kill/relaunch, camera permissions, account switching and radio loss on the supported iOS/Android devices before rollout.

See [review/fix status](../navo-api/docs/REMEDIATION.md). Push notifications and dedicated voice capture remain future work; dictation currently uses the device keyboard.
