# navo-mobile

Expo app. Check: `npm run typecheck && npm run lint && npm test && npm run bundle-check`.

- HTTP only through `src/lib/api.ts` (token in expo-secure-store, request id). Data screens use
  `useApi` (keeps last data, offline banner, pull to refresh).
- Terms, flags and errors share the web app's locale keys (`src/locales`, both languages); keep
  them in step with `../navo/src/locales`.
- `src/lib/format.ts`, `types.ts`, `contractText.ts` are ports of the web app's files; change both
  together. Never compute KPIs or flags on the phone: they come from the API.
- UI primitives in `src/components/ui.tsx` (Lova Driver tokens: ≥16 px body text, ≥44 px targets,
  icon + text for status).
