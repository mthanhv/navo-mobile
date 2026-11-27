# Mobile app: business logic

Rules live in the API — [navo-api/docs/BUSINESS_RULES.md](../../navo-api/docs/BUSINESS_RULES.md).
The phone is for people away from a desk: see where contracts stand, what goods are coming, and log
field notes with photos. Confirming documents and money happen on the web.

## Who sees what

Role choices are in `src/lib/roles.ts`; permissions still decide every action (the API checks).

| User | Home tab | Orders tab | Can write |
|---|---|---|---|
| sales | "Today": own tasks, unsent note drafts, goods awaited this week | no (awaited goods are on Today) | notes, photos, tasks, new leads (name card) |
| sales_manager | "Today" | yes | notes, photos, tasks |
| delivery, accounting, admin | company overview | yes | no notes/tasks (needs contracts.write) |
| technician | "Service visits": the visits assigned to them | no | records their visits (work, findings, photos of the signed report) |
| no contracts.read (other) | "use the web" | no | — |

- Contracts tab: active contracts in the user's scope; a contract shows lines (remaining, delivered,
  available, ordered, received), its POs and deliveries, and earlier field notes of the customer.
- Admins who must turn on two-step sign-in (production) see a screen asking them to set it up on the
  web, with sign-out.
- A password an admin typed is temporary: the phone shows only a change-password screen until the
  person chooses their own (new people normally set theirs from the web invitation link).
- Planners (delivery, sales manager, admin) reach "Service visits" from the overview; a visit opens
  with where to go and what to do.

## Recording a visit

`src/app/(app)/visit/[id].tsx`: date (dd/mm/yyyy, not in the future), work done, findings, photos
(signed report or machine; camera or library). The record carries one Idempotency-Key per screen
and each photo its own client id, so retrying after a lost answer never records or uploads twice;
photos not yet sent stay on screen with "send the photos again".

## Field notes

- Drafts are kept on the device per installation and user (`src/lib/drafts.ts`), autosaved when the
  app goes to the background, never shown to another account.
- Sending creates the note (with a client id, so a retry does not duplicate it), then uploads photos
  one by one with checkpoints; a photo is sent once.
- AI note parsing is optional (`/ai/status`).

## New lead from a name card

`src/app/(app)/lead-new.tsx`, opened by "Khách mới" on Today (contracts.write). The form has the web
lead drawer's fields plus one contact person. "Chụp danh thiếp" (or a photo from the library) keeps
the card photo, shrunk to a JPEG of at most 1600 px (`src/lib/cardScan.ts`), and asks the API to read
it; the reading fills only the fields still empty, so nothing typed meanwhile is lost, and a failed
or offline read never blocks typing (shown only when `/ai/status` is on). Possible duplicates
(tax code, similar name, phone) are shown as on the web. Saving needs a connection: the lead is
created with one Idempotency-Key per screen, then the photo goes on a "Danh thiếp" note; if only
the photo fails, the lead stays created and the screen says so.

## Data freshness

`useApi` keeps the last data, shows when it was fetched and an offline/stale banner, and supports
pull to refresh. Contract details and documents load and fail independently.

## Shared with the web

`src/lib/api-schema.d.ts` is generated from navo-api's OpenAPI description (`npm run api:types`) and
`src/lib/api-types.ts` names the shapes (same file as the web's). `src/lib/format.ts`, `types.ts`,
`contractText.ts` are ports of the web files and the locale keys
are shared (`src/locales`, both languages). Since 24 November the shared types and
helpers match the web, and the home screen's figures (contracts with late deliveries, firm/tentative
deliveries, goods arriving this week, a PO fully received) come from the API. Delivery sees no prices
(the API omits them).
