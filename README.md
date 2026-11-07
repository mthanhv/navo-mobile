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

## Next

Quick notes, tasks and photos with drafts kept on the phone (needs the notes/tasks API), voice input,
push notifications.
