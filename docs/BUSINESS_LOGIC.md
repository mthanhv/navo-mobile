# Mobile app: business logic

Rules live in the API — [navo-api/docs/BUSINESS_RULES.md](../../navo-api/docs/BUSINESS_RULES.md).
The phone is for people away from a desk: see where contracts stand, what goods are coming, and log
field notes with photos. Confirming documents and money happen on the web.

## Who sees what

Role choices are in `src/lib/roles.ts`; permissions still decide every action (the API checks).

| User | Home tab | Orders tab | Can write |
|---|---|---|---|
| sales | "Today": own tasks, unsent note drafts, goods awaited this week | no (awaited goods are on Today) | notes, photos, tasks |
| sales_manager | "Today" | yes | notes, photos, tasks |
| delivery, accounting, admin | company overview | yes | no notes/tasks (needs contracts.write) |
| no contracts.read | "use the web" | no | — |

- Contracts tab: active contracts in the user's scope; a contract shows lines (remaining, delivered,
  available, ordered, received), its POs and deliveries, and earlier field notes of the customer.
- Admins who must turn on two-step sign-in (production) see a screen asking them to set it up on the
  web, with sign-out.

## Field notes

- Drafts are kept on the device per installation and user (`src/lib/drafts.ts`), autosaved when the
  app goes to the background, never shown to another account.
- Sending creates the note (with a client id, so a retry does not duplicate it), then uploads photos
  one by one with checkpoints; a photo is sent once.
- AI note parsing is optional (`/ai/status`).

## Data freshness

`useApi` keeps the last data, shows when it was fetched and an offline/stale banner, and supports
pull to refresh. Contract details and documents load and fail independently.

## Shared with the web

`src/lib/format.ts`, `types.ts`, `contractText.ts` are ports of the web files and the locale keys
are shared (`src/locales`, both languages). Since 24 November the shared types and
helpers match the web, and the home screen's figures (contracts with late deliveries, firm/tentative
deliveries, goods arriving this week, a PO fully received) come from the API. Delivery sees no prices
(the API omits them).
