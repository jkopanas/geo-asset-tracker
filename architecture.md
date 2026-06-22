# Geo Asset Tracker — Architecture

This document records every architectural decision made for this project.
Each decision includes the choice, why it was made, alternatives considered, and tradeoffs
accepted. It is written for the reviewer as much as for the implementer.

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Browser (localhost:5173)                     │
│                                                                     │
│   ┌─────────────┐   ┌──────────────┐   ┌────────────────────────┐  │
│   │  FilterBar  │   │   AssetMap   │   │  AssetList (paginated) │  │
│   └─────────────┘   │  (Leaflet)   │   └────────────────────────┘  │
│                     └──────────────┘                               │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │                   TanStack Query Cache                       │  │
│   └──────────────────────────────┬───────────────────────────────┘  │
└──────────────────────────────────┼──────────────────────────────────┘
                                   │ HTTP (fetch)
                                   │ localhost:3000
┌──────────────────────────────────┼──────────────────────────────────┐
│                        Express API                                  │
│                                  │                                  │
│   cors → json → logger → router ──┬──► validate(querySchema)        │
│                                   │         → listAssets controller  │
│                                   ├──► validate(createSchema)        │
│                                   │         → createAsset controller │
│                                   └──► (no body validation)          │
│                                             → getAsset / delete ...  │
│                                                                      │
│   ┌────────────────────────────────────┐                            │
│   │  AssetController                   │                            │
│   │  (calls store directly)            │                            │
│   └───────────────┬────────────────────┘                            │
│                   │                                                  │
│   ┌───────────────▼────────┐                                        │
│   │  AssetStore (interface)│  ← swappable                          │
│   │  (in-memory)           │                                        │
│   └───────────────┬────────┘                                        │
│                   │                                                  │
│   Map<id, Asset>  ← seeded from seed.json on startup               │
└─────────────────────────────────────────────────────────────────────┘

shared/
  schemas.ts   ← Zod schemas (source of truth for types + validation)
  types.ts     ← TypeScript types inferred from schemas
```

## Project Structure

```
geo-asset-tracker/
├── api/
│   ├── src/
│   │   ├── routes/
│   │   │   └── assets.ts            # router: registers endpoints + per-route validate()
│   │   ├── controllers/
│   │   │   └── assets.controller.ts # parse req → call store → format res
│   │   ├── store/
│   │   │   ├── asset-store.ts       # AssetStore interface
│   │   │   └── memory.store.ts      # in-memory implementation
│   │   ├── middleware/
│   │   │   ├── error.ts             # global error handler (last middleware)
│   │   │   └── validate.ts          # Zod validation middleware factory
│   │   ├── errors/
│   │   │   └── app-errors.ts        # NotFoundError, ValidationError, AppError
│   │   ├── app.ts                   # Express app setup — exported, no listen()
│   │   └── server.ts                # entry point: imports app, calls app.listen(3000)
│   ├── tests/
│   │   └── assets.test.ts           # 8 integration tests via Supertest
│   ├── package.json
│   └── tsconfig.json
│
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── FilterBar/
│   │   │   │   └── FilterBar.tsx
│   │   │   ├── AssetList/
│   │   │   │   ├── AssetList.tsx
│   │   │   │   └── AssetListItem.tsx
│   │   │   ├── AssetMap/
│   │   │   │   ├── AssetMap.tsx
│   │   │   │   └── AssetMarker.tsx
│   │   │   ├── AssetDetail/
│   │   │   │   └── AssetDetail.tsx
│   │   │   └── AssetForm/
│   │   │       ├── AssetForm.tsx
│   │   │       └── LocationPicker.tsx
│   │   ├── hooks/
│   │   │   ├── useMapAssets.ts      # map query: filters + bbox, no pagination (limit=500)
│   │   │   ├── useAssets.ts         # list query: filters + bbox + page + limit=25
│   │   │   ├── useAsset.ts          # single asset — cache-miss fallback for AssetDetail
│   │   │   └── useAssetMutations.ts # create, update, delete + cache invalidation
│   │   ├── lib/
│   │   │   ├── api.ts               # typed fetch wrapper, base URL, error parsing
│   │   │   └── constants.ts         # STATUS_COLORS: Record<Status, string>
│   │   ├── App.tsx                  # root state: selectedId, filters, bbox, page
│   │   └── main.tsx
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── shared/
│   ├── schemas.ts                   # Zod schemas — single source of truth
│   └── types.ts                     # types inferred from schemas
│
├── seed.json
├── package.json                     # root: concurrently dev + build scripts
└── README.md
```

**Why this structure, not alternatives:**

- **Why two **`package.json`** files (not monorepo tooling):** Turborepo and Nx solve build
graph problems at scale. For one backend and one frontend, they are 2–3 hours of setup
with no visible payoff. Two independent packages in one repo is sufficient and easier
for the reviewer to navigate.
- **Why **`shared/`** at root (not an npm workspace):** A workspace requires declaring the
dependency in both `package.json` files and configuring workspace resolution in the root.
A plain directory with TypeScript path aliases achieves the same compile-time type safety
with zero runtime ceremony. See the alias configuration section below.
- **Why no **`services/`** layer:** There is no business logic that is isolated from HTTP
today. An empty pass-through service adds a file to read, an import chain to trace, and
ambiguity about where logic belongs. Controllers call the store directly. The service
layer is added when the first real business rule appears (e.g., "emit an event when an
asset goes critical") — at that point it earns its existence.
- **Why **`app.ts`** and **`server.ts`** are separate:** Supertest does not need a listening
server — it injects requests directly into the Express app. If `app.listen()` is called
at import time, every test file that imports the app binds port 3000 and the second
test file throws `EADDRINUSE`. `app.ts` exports the configured Express instance with no
side effects. `server.ts` is the entry point that calls `app.listen(3000)`. Tests import
from `app.ts`.

### `shared/` path alias — three required configuration points

The alias must be declared in three places. Missing any one of them produces a build that
TypeScript accepts but fails at runtime or bundle time:

```
1. api/tsconfig.json
   "paths": { "@shared/*": ["../shared/*"] }

2. client/tsconfig.json
   "paths": { "@shared/*": ["../shared/*"] }

3. client/vite.config.ts
   resolve: { alias: { '@shared': path.resolve(__dirname, '../shared') } }
```

Vite does not read `tsconfig.json` paths. Missing the Vite alias produces a build that
TypeScript accepts but Vite cannot bundle — a silent failure that is hard to diagnose.

## 1. Frontend Architecture

### Component Tree

```
App                              ← owns: selectedAssetId, filters, bbox, page
│
├── QueryClientProvider
│   │
│   └── Layout
│       │
│       ├── FilterBar            ← reads/writes: filters (calls setFilters + setPage(1))
│       │     (type checkboxes, status checkboxes)
│       │
│       ├── AssetMap             ← reads: filters + bbox
│       │   │                     emits: bbox on viewport change (calls setBbox + setPage(1))
│       │   │                     emits: selectedAssetId on marker click
│       │   │                     uses: useMapAssets(filters, bbox) — no pagination
│       │   │
│       │   └── AssetMarker[]    ← color = STATUS_COLORS[status], onClick → selectedAssetId
│       │
│       ├── AssetList            ← reads: filters + bbox + page
│       │   │                     emits: selectedAssetId on row click
│       │   │                     emits: page on pagination click
│       │   │                     uses: useAssets(filters, bbox, page) — paginated
│       │   │
│       │   └── AssetListItem[]  ← color indicator = STATUS_COLORS[status]
│       │                          onClick → selectedAssetId
│       │
│       ├── AssetDetail          ← reads: selectedAssetId
│       │                          uses: useAsset(id) with initialData from map query cache
│       │                          emits: open AssetForm(asset) on edit click
│       │
│       └── AssetForm            ← no id → create mode (POST)
│               │                  with id → edit mode (PATCH)
│               │
│               └── LocationPicker ← embedded Leaflet map
│                                    click → sets lat + lng fields
```

### Map vs. list pagination — two separate queries

The map and list have fundamentally different data needs:

- **Map (**`useMapAssets`**)**: fetches all matching assets with `limit=500`, no page
parameter. Every marker in the current filtered set must be visible. Showing only 25
markers while the list shows 25 rows would be confusing — the map would appear to be
missing assets.
- **List (**`useAssets`**)**: fetches the same filtered set paginated at 25 per page. The
list is the browsable, detail-oriented view.

Both hooks share the same `filters` and `bbox` state from `App`, so they always reflect
the same filtered set. They differ only in their `limit` and `page` parameters, which
means their TanStack Query cache keys are distinct — no collision, no shared invalidation
problem.

```
useMapAssets(filters, bbox)
  → GET /assets?type=...&status=...&bbox=...&limit=500
  → returns up to 500 markers, no meta.pages needed

useAssets(filters, bbox, page)
  → GET /assets?type=...&status=...&bbox=...&page=1&limit=25
  → returns 25 rows + meta: { total, page, limit, pages }
```

### `currentPage` reset — co-located state updates

When filters or bbox change, `page` must reset to 1. The correct pattern is to reset page
at the same call site as the filter/bbox update — not in a `useEffect`:

```
// FilterBar onChange (handler lifted to App):
setFilters(next);
setPage(1);

// AssetMap onMoveEnd handler:
setBbox(newBbox);
setPage(1);
```

A `useEffect` watching `filters` and `bbox` to reset page causes a double render and a
double fetch. Co-located updates are a single synchronous state batch.

### `useAsset` — cache-miss fallback for `AssetDetail`

`AssetDetail` uses `useAsset(selectedId)` with TanStack Query's `initialData` option
populated from the map query cache when available:

```
initialData: () =>
  queryClient
    .getQueryData<MapAssetsResponse>(['mapAssets', filters, bbox])
    ?.data.find(a => a.id === selectedId)
```

Happy path (asset is in the map cache): no network request, instant render.
Cache-miss path (direct URL navigation, asset outside current bbox): `useAsset` fires
`GET /assets/:id` and fetches the single asset. `useAsset.ts` is not dead code — it is
the fallback that makes `AssetDetail` work in all navigation scenarios.

### `STATUS_COLORS` — single source of truth

Both `AssetMarker` and `AssetListItem` map `status → color`. Without a shared constant,
these two maps will be written independently and will drift. The constant lives in
`client/src/lib/constants.ts`:

```
STATUS_COLORS: Record<'ok' | 'warning' | 'critical', string>
  ok       → green  (#22c55e)
  warning  → amber  (#f59e0b)
  critical → red    (#ef4444)
```

Both components import from `constants.ts`. No inline color strings in components.

### Why these components, not alternatives:

- **Why one **`AssetForm`** for create and edit:** The form fields are identical. The only
difference is the initial values and the HTTP verb on submit. A single component
with an optional `asset` prop eliminates duplication and keeps the validation schema in
one place.
- **Why **`AssetDetail`** is separate from **`AssetForm`**:** Detail is read-only; form is
write-only. Mixing them creates a component that has two modes and two reasons to
change.
- **Why **`LocationPicker`** is a sub-component:** It is a Leaflet map instance. Embedding it
inside the form directly would make the form component responsible for map lifecycle,
which is a different concern. `LocationPicker` receives `onLocationChange` and reports
`{ lat, lng }` — it does not know about the form.

## 2. Backend Architecture

### Request Lifecycle

```
Incoming HTTP Request
        │
        ▼
┌───────────────────────────────────────────┐
│ Global Middleware (applied to all routes) │
│                                           │
│  cors()          allow localhost:5173     │
│  express.json()  parse request body       │
│  requestLogger   console.log method+path  │
└─────────────────────┬─────────────────────┘
                      │
                      ▼
┌───────────────────────────────────────────┐
│ Router: /assets                           │
│                                           │
│  GET    /    validate(querySchema)        │
│              → listAssets                 │
│                                           │
│  GET    /:id (no body validation)         │
│              → getAsset                   │
│                                           │
│  POST   /    validate(createSchema, body) │
│              → createAsset                │
│                                           │
│  PATCH  /:id validate(updateSchema, body) │
│              → updateAsset                │
│                                           │
│  DELETE /:id (no body validation)         │
│              → deleteAsset                │
└─────────────────────┬─────────────────────┘
                      │
         validate(schema) is a per-route middleware factory.
         It is NOT a single global step.
         Each route registers the schema appropriate for its
         request shape (body vs. query, required vs. optional).
                      │
                      ▼
┌───────────────────────────────────────────┐
│ validate(schema) — per route              │
│                                           │
│  Zod.safeParse(req.body | req.query)      │
│  on failure → throw ValidationError(400) │
│  on success → req.validated = parsed      │
└─────────────────────┬─────────────────────┘
                      │
                      ▼
┌───────────────────────────────────────────┐
│ Controller                                │
│                                           │
│  reads req.validated (typed, safe)        │
│  calls store directly                     │
│  formats { data } or { data, meta }       │
│  sets correct status code                 │
└─────────────────────┬─────────────────────┘
                      │
                      ▼
┌───────────────────────────────────────────┐
│ AssetStore (interface)                    │
│                                           │
│  findAll(filters)  → { assets, total }    │
│  findById(id)      → Asset | null         │
│  create(input)     → Asset                │
│    input: CreateAssetInput (no id field)  │
│    store generates id via crypto.randomUUID() │
│  update(id, patch) → Asset | null         │
│    merges only present fields; empty {}   │
│    is valid and returns asset unchanged   │
│  delete(id)        → boolean              │
│  seed(assets)      → void                 │
│                                           │
│  MemoryStore implements AssetStore        │
│  filter logic runs INSIDE the store       │
└─────────────────────┬─────────────────────┘
                      │
                      ▼
              Map<string, Asset>

        ↑ If any step throws an AppError subclass ↑

┌───────────────────────────────────────────┐
│ Error Handler middleware (last in chain)  │
│                                           │
│  NotFoundError   → 404                    │
│  ValidationError → 400 + fields           │
│  AppError        → error.statusCode       │
│  unknown Error   → 500 (no stack in body) │
│                                           │
│  all produce: { error: { code, message }} │
└───────────────────────────────────────────┘
```

### Why controllers call the store directly (no service layer):

There is no business logic today that is isolated from HTTP. An empty service that does
nothing but delegate to the store adds one file to read, one import chain to trace, and
a question every future reader asks: "does business logic go here or in the controller?"
When there is actual business logic (a validation rule, an event to emit, a side effect),
the service layer earns its existence. Right now it is premature abstraction.

The one rule that might seem like "business logic" — UUID generation on create — belongs
in the store's `create` method, not a service. The store owns identity; it receives
`CreateAssetInput` (no `id`), generates `crypto.randomUUID()` internally, and returns the
full `Asset`.

### Why the store is an interface:

`MemoryStore` is the only implementation today. But the interface contract is what
production code would look like. Any reviewer reading `AssetStore` knows exactly what a
`PostgresStore` would require. The migration path is: write `PostgresStore implements AssetStore`, swap the binding in `app.ts`, done. Nothing else changes.

## 3. Database Architecture

**Decision: In-memory store (**`Map<string, Asset>`**)**

### Seeding strategy

```
startup (server.ts)
  │
  ▼
read seed.json using ESM-safe path resolution:
  const url = new URL('../../seed.json', import.meta.url);
  const raw = fs.readFileSync(url, 'utf-8');
  │
  ▼
parse JSON → Asset[]
  │
  ▼
store.seed(assets)
  │
  ├── MemoryStore: clear map, insert all → idempotent by definition
  └── PostgresStore (future): INSERT ... ON CONFLICT (id) DO NOTHING
```

**Why ESM-safe path resolution:** This project uses Node.js ESM (`"type": "module"` in
`package.json`). In ESM, `__dirname` is not available. `path.join(__dirname, ...)` throws
at runtime. `new URL('../../seed.json', import.meta.url)` is the correct ESM-native
pattern and works with `fs.readFileSync`. This is a real runtime failure that is easy to
miss — it is called out here so it is not discovered during implementation.

The seeding is always a clear + reload in memory. Every restart gives a clean slate.
This is documented in the README. It is not a bug — it is the accepted tradeoff for
choosing in-memory.

### Migration path to Postgres (not implemented)

```
MemoryStore (current)          PostgresStore (future)
─────────────────────          ──────────────────────
Map<string, Asset>       →     assets table (same schema)

findAll with bbox filter  →    WHERE lat BETWEEN $1 AND $2
                               AND lng BETWEEN $3 AND $4

create(input)             →    INSERT INTO assets ... RETURNING *

seed(assets)              →    INSERT ... ON CONFLICT (id) DO NOTHING
```

The store interface does not change. Only the implementation swaps.

### Why not Postgres now:

Three hours of setup (Docker, pg client, connection pool, migrations, seed upsert logic)
for zero visible difference to an app with 150 assets. The time is better spent on API
design, the geospatial filter, and frontend quality — the things the brief says are
evaluated.

### Why not MongoDB:

Good native geospatial support (`$geoWithin`), but adds Docker dependency and document
model provides no advantage over a flat row for this schema. The data shape is fixed and
relational-friendly.

### Why not SQLite:

No Docker required, persistent across restarts. Reasonable alternative. Skipped because
`better-sqlite3` is a native add-on (requires build toolchain), and migrations still need a
file. In-memory with a clear migration path is simpler to explain and faster to ship.

## 4. API Architecture

### Endpoints

```
Method   Path           Description                      Status codes
───────  ─────────────  ───────────────────────────────  ────────────────────────
GET      /assets        List, filter, paginate           200
GET      /assets/:id    Single asset                     200, 404
POST     /assets        Create                           201 + Location header, 400
PATCH    /assets/:id    Partial update                   200, 400, 404
DELETE   /assets/:id    Delete                           204, 404
```

### Why `/assets` (not `/api/v1/assets`):

No external consumer will ever call this API. Versioning is a pattern for when you need to
support multiple simultaneous API versions without breaking existing clients. It adds path
noise with no benefit here. If the API ever needed versioning, the prefix is trivial to
add.

### Why PATCH (not PUT) for edits:

The edit form allows changing any subset of fields. PUT semantics require the client to
send the full resource on every save — creating a read-before-write requirement and a race
condition if two clients edit simultaneously. PATCH is the correct verb for partial update
and matches form behavior.

### Query parameters

```
GET /assets

?type=pipe                           filter by type (pipe | hydrant | sensor | valve)
?type=pipe&type=valve                multi-value: returns pipes OR valves
?status=warning                      filter by status (ok | warning | critical)
?status=warning&status=critical      multi-value: returns warning OR critical
?bbox=-74.02,40.70,-73.93,40.78      bounding box: minLng,minLat,maxLng,maxLat (WGS84)
?page=1                              1-indexed page number (default: 1)
?limit=25                            page size (default: 25, max: 100)
                                     map query uses limit=500 to fetch all markers
```

**Filter semantics:**

- Multiple values of the same param → OR (pipes OR valves)
- Different params combined → AND (pipes that are warning)
- `bbox` AND `type=pipe` → pipes inside the box

### Response envelope

```
// List response
{
  "data": [
    {
      "id": "17fc695a-...",
      "name": "Sensor S-0001",
      "type": "sensor",
      "status": "ok",
      "lat": 42.373366,
      "lng": -71.133174,
      "installed_at": "2001-04-05",
      "last_inspected_at": "2025-09-21",
      "notes": ""
    }
    // ...
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 25,
    "pages": 6
  }
}

// Single resource response
{
  "data": { ...asset }
}

// Error response (all errors)
{
  "error": {
    "code": "ASSET_NOT_FOUND",
    "message": "No asset with id 'abc-123' exists."
  }
}

// Validation error (adds field-level detail)
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request body is invalid.",
    "fields": {
      "lat": "Must be a number between -90 and 90.",
      "name": "Required."
    }
  }
}
```

**Why a consistent envelope:**
A bare array response cannot carry pagination metadata. An envelope makes the contract
explicit and extensible: adding a `links` key for cursor pagination or a `warnings` key
for partial failures requires no breaking change.

**Why offset/page pagination (not cursor):**
Cursor pagination is superior for large datasets with frequent inserts (avoids page drift).
For 150 assets with infrequent writes, offset is correct and the simpler implementation.
The meta shape (`total`, `pages`) already supports a UI with numbered page controls.

### HTTP status codes in use

```
200  OK              GET list, GET single, PATCH success
201  Created         POST success (Location: /assets/:id header included)
204  No Content      DELETE success (no body)
400  Bad Request     Missing required field, wrong type, invalid enum value,
                     or malformed bbox (e.g., 3 values instead of 4)
404  Not Found       Asset id does not exist (GET, PATCH, DELETE)
500  Internal Error  Unexpected — logged on server, no stack trace in response
```

**Why no 422:** The only candidate for 422 was a malformed bbox parameter. A client
receiving 422 vs 400 for a malformed bbox changes nothing about their recovery behavior —
they fix the request and resubmit either way. A distinct status code for a behaviorally
identical outcome is over-engineering. All client errors return 400 with a descriptive
message. Two error classes (`NotFoundError`, `ValidationError`) are sufficient.

## 5. State Management Strategy

### State ownership map

```
State                      Owner                  Why here
─────────────────────────  ─────────────────────  ──────────────────────────────────────
Asset list (paginated)     TanStack Query cache   Server state: async, cacheable, stale
Asset map markers          TanStack Query cache   Separate query, higher limit, no page
Single asset               TanStack Query cache   Cache-miss fallback via useAsset
selectedAssetId            useState in App        Shared by map markers and list rows
filters (type, status)     useState in App        Drives both map query and list query
bbox                       useState in App        Updated by map, consumed by both views
page                       useState in App        List-only; resets on filter/bbox change
form field values          React Hook Form        Form-local, dirty tracking, validation
map viewport               Leaflet internal       Map controls its own viewport
```

### State flow

```
User interaction flow:

[FilterBar]
 user checks "warning"
      │
      ▼
 setFilters(next); setPage(1);   ← co-located, single batch
      │
      ├──────────────────────────────────────────────────────────┐
      ▼                                                          ▼
 useAssets(filters, bbox, page=1) refetch            useMapAssets(filters, bbox) refetch
 GET /assets?status=warning&page=1&limit=25          GET /assets?status=warning&limit=500
      │                                                          │
      ▼                                                          ▼
 AssetList renders filtered rows (page 1)           AssetMap renders all filtered markers

[AssetMap]
 user pans/zooms map
      │
      ▼
 onMoveEnd → normalize bbox coords → setBbox(newBbox); setPage(1);
      │
      ├──────────────────────────────────────────────────────────┐
      ▼                                                          ▼
 useAssets refetches with new bbox, page=1          useMapAssets refetches with new bbox

[AssetMap]
 user clicks a marker
      │
      ▼
 AssetMarker onClick → setSelectedAssetId(id)
      │
      ▼
 AssetDetail calls useAsset(id) with initialData from useMapAssets cache
 → cache hit: instant render, no network request
 → cache miss (direct URL nav): GET /assets/:id fires

[AssetForm]
 user submits create/edit
      │
      ▼
 mutation succeeds → queryClient.invalidateQueries(['assets'])
                   → queryClient.invalidateQueries(['mapAssets'])
 both queries refetch → list and map update
```

### Why TanStack Query (not SWR or manual fetch):

TanStack Query handles the full server state lifecycle: background refetch, stale-while-
revalidate, cache invalidation on mutation, and deduplicated concurrent requests. The key
insight is the mutation → invalidation pattern: after `PATCH /assets/:id`, calling
`queryClient.invalidateQueries` causes both the list and map to refetch without manual
state synchronization. SWR does the same job; TanStack Query has better TypeScript
support and explicit mutation handling.

### Why no global store (Zustand, Redux):

`selectedAssetId`, `filters`, `bbox`, and `page` are 1–2 levels of prop drilling from
`App` to consumers. Adding a global store for this introduces indirection — reading from a
store instead of props means the data flow is no longer traceable by following the
component tree. At this component depth, prop drilling is the more readable choice.

## 6. Validation Strategy

### Where validation lives and why

```
shared/schemas.ts
      │
      ├──► api/middleware/validate.ts
      │         │
      │         ├── validates req.body on POST (CreateAssetSchema)
      │         ├── validates req.body on PATCH (UpdateAssetSchema — all fields optional)
      │         ├── validates req.query on GET (AssetQuerySchema — bbox, type, status, page, limit)
      │         └── on failure: throws ValidationError → 400 with field errors
      │
      └──► client/components/AssetForm/AssetForm.tsx
                │
                └── React Hook Form + zodResolver(CreateAssetSchema)
                    on failure: inline field errors, form does not submit
```

### Zod schemas (not code, but structure)

```
AssetSchema           — full asset shape (id + all fields)
CreateAssetSchema     — required fields for POST (name, type, status, lat, lng,
                        installed_at; last_inspected_at nullable; notes optional)
UpdateAssetSchema     — all fields optional (PATCH semantics)
                        empty body {} is valid → returns asset unchanged
                        null value for last_inspected_at → clears the field
                        absent field → field is not touched
AssetQuerySchema      — query string: type[], status[], bbox string → parsed coords,
                        page, limit
BBoxSchema            — exactly 4 numbers: [minLng, minLat, maxLng, maxLat]
                        lat in [-90, 90], lng in [-180, 180]
                        fewer or more than 4 values → ValidationError 400
```

### Why Zod (not class-validator, joi, yup):

Zod is the only validation library that produces TypeScript types from the schema as a
first-class feature. `z.infer<typeof CreateAssetSchema>` gives you the input type without
writing it separately. It runs identically in Node.js and the browser, which is why the
schema can live in `shared/` and serve both sides. Class-validator requires decorators and
reflection metadata. Joi and yup do not produce TypeScript types by default.

### Validation rules for key fields

```
name           required, non-empty string
type           enum: pipe | hydrant | sensor | valve
status         enum: ok | warning | critical
lat            number, min -90, max 90
lng            number, min -180, max 180
installed_at   ISO date string (YYYY-MM-DD)
last_inspected_at  ISO date string or null
notes          string (empty string is valid)
bbox (query)   exactly 4 comma-separated numbers in coordinate range
page           integer ≥ 1 (default: 1)
limit          integer 1–100 (default: 25); map query sends 500 (above schema max,
               handled as a special internal value or schema extended to 500)
```

### Why server validation is non-negotiable even with client validation:

Client validation is a UX courtesy — it prevents the round trip for obvious mistakes.
Server validation is a correctness guarantee — it enforces the contract regardless of what
sends the request. A curl command, a broken frontend build, or a future mobile client all
bypass client validation. The server must not trust any input.

## 7. Error Handling Strategy

### Error class hierarchy

```
AppError (base)
  │  statusCode: number
  │  code: string
  │  message: string
  │
  ├── NotFoundError      statusCode: 404, code: "NOT_FOUND"
  └── ValidationError    statusCode: 400, code: "VALIDATION_ERROR"
        fields?: Record<string, string>
```

Two classes. `UnprocessableError` (422) has been removed — the only case that called for
it (malformed bbox) is behaviorally identical to a 400 and is handled by `ValidationError`.

### Error handler middleware (last in chain)

```
Any thrown error in routes, controllers, or store
       │
       ▼
Express error handler (4-argument middleware)
       │
       ├── is AppError subclass?
       │     yes → use error.statusCode + error.code
       │     no  → 500, code: "INTERNAL_ERROR"
       │
       ├── is ValidationError?
       │     yes → include error.fields in response
       │
       └── log to console.error (always, including 500s)
             never expose stack trace in response body
       │
       ▼
res.status(code).json({
  error: {
    code: "...",
    message: "...",
    fields: { ... }  // validation errors only
  }
})
```

### Client-side error handling

```
TanStack Query mutation error    → catch in onError callback
                                   show inline error near the form or action
                                   parse { error: { code, message } } shape

TanStack Query query error       → show error message in list/map area
                                   "Could not load assets. Try again."

Catastrophic render error        → React error boundary at App root
                                   shows a fallback UI, not a blank screen
```

### Why typed error classes (not returning error objects from services):

Throwing stops execution immediately and unwinds to the nearest error handler. Returning
error objects requires every caller to check the return value and propagate — which is easy
to forget. Typed classes let the error handler distinguish cases with `instanceof` without
any coupling between the throw site and the handler.

### What is NOT handled:

- Rate limiting: out of scope
- Auth errors (401/403): out of scope
- Network timeouts: the app runs locally; timeout handling would be premature
- Retry logic on the client: TanStack Query has built-in retry, left at default (3 retries
for queries, 0 for mutations — default behavior matches our needs)

## 8. Geospatial Query Strategy

**Decision: Bounding box filter, computed inside the store.**

### Why bounding box (not radius):

A bounding box maps directly to the map viewport. When the user pans or zooms, Leaflet's
`map.getBounds()` returns a bounding box — it is the natural unit of "what I can see." A
radius filter maps to "find assets near a point," which is a different interaction model
(nearest-neighbor search) not described in the brief. Bounding box requires no additional
UI affordance.

### Why the filter runs inside the store:

```
WRONG — filter in the route handler:

  const allAssets = await store.findAll()         // loads all 150 rows
  const filtered = allAssets.filter(inBbox)       // application-layer filter

CORRECT — filter inside the store:

  const { assets, total } = await store.findAll({ bbox, type, status, page, limit })
  // the store applies all filters before returning any rows
  // pagination count reflects filtered total, not total total
```

The filter pushed into the store is equivalent to a SQL `WHERE` clause. When the store
implementation is eventually swapped for Postgres, the filter becomes a real `WHERE`
clause. The calling code does not change.

Critically: pagination depends on the filtered total. If you filter after fetching, your
`meta.total` is the unfiltered count, and your page slicing is wrong.

### Bounding box implementation

```
Query: GET /assets?bbox=-74.02,40.70,-73.93,40.78

Parse: [minLng, minLat, maxLng, maxLat] = [-74.02, 40.70, -73.93, 40.78]

Filter inside store.findAll():

  Latitude check (same in all cases):
    asset.lat >= minLat  AND  asset.lat <= maxLat

  Longitude check — two cases based on whether the box crosses the antimeridian:

  Case A — normal box (minLng <= maxLng):
    e.g., bbox=-74.02,40.70,-73.93,40.78
    asset.lng >= minLng  AND  asset.lng <= maxLng

  Case B — antimeridian-crossing box (minLng > maxLng):
    e.g., bbox=170.0,35.0,-170.0,50.0  (wraps through ±180°)
    asset.lng >= minLng  OR   asset.lng <= maxLng

  Detection: if (minLng > maxLng) → antimeridian case

Applied in order: type filter → status filter → bbox filter → count total → paginate slice
```

**Why the antimeridian case works:**

When a bounding box crosses ±180°, the longitude range is not a contiguous interval on the
number line — it is the complement of the gap in the middle. A point at lng=175 and a
point at lng=-175 are both inside a box from 170 to -170. The OR condition captures both
sides of the split. No coordinate transformation or special API shape is needed — the same
`minLng,minLat,maxLng,maxLat` format signals the crossing naturally when `minLng > maxLng`.

Leaflet's `map.getBounds()` returns `LatLngBounds` where `getWest()` and `getEast()` can
produce values outside [-180, 180] when the map wraps (e.g., `getEast()` returns 190
instead of -170). The bbox must be normalized before sending to the API:
`lng = ((lng + 180) % 360) - 180`. This normalization lives in the `onMoveEnd` handler
on `AssetMap`, before the bbox is written to state.

### Coordinate system

WGS84 (EPSG:4326) — the same coordinate system as the seed data and Leaflet. No
projection or transformation required. The arithmetic is Cartesian approximation, which is
correct for the geographic scale of this dataset (northeastern US, sub-degree spans).

### Production path

```
In-memory (now):      Cartesian range check in JavaScript
Postgres (future):    WHERE lat BETWEEN $1 AND $2 AND lng BETWEEN $3 AND $4
                      or: WHERE ST_Within(geom, ST_MakeEnvelope($1,$2,$3,$4,4326))
MongoDB (future):     { location: { $geoWithin: { $box: [[minLng,minLat],[maxLng,maxLat]] } } }
```

The store interface absorbs the change. Routes and controllers are unchanged.

## 9. Testing Strategy

**Framework: Vitest + Supertest**

### Why Vitest (not Jest):

Vitest is faster and requires no Babel configuration for TypeScript ESM. It uses the same
config file as Vite, so the test environment is consistent with the frontend build. API
tests need no DOM, so `environment: 'node'` is the default.

### Why Supertest (not mocking the store):

Supertest makes HTTP requests against the real Express app. This catches middleware ordering
bugs, content-type header issues, and CORS configuration problems that unit tests on
controllers miss. The test hits the real route → middleware → controller → store chain.
The store is in-memory so tests are fast and isolated without any mocking.

### Test isolation — `beforeEach` re-seed

The store is shared across all tests in the file. Test 8 deletes an asset. Without
re-seeding, any subsequent test that references that asset's ID will get a 404 instead of
the expected result, producing order-dependent failures that are hard to diagnose.

The fix is one call at the top of the test file:

```
beforeEach(() => {
  store.seed(seedData);   // clear + reload all 150 assets before every test
});
```

The store instance must be importable by the test file — it is exported from `app.ts`
alongside the Express app. Tests import both `app` (for Supertest) and `store` (for
`beforeEach`).

### The 8 tests (and why each one)

```
Test 1: bbox filter — assets inside are returned
  Why: proves the filter is inclusive on the boundary condition.
  The most basic correctness check for the feature.

Test 2: bbox filter — assets outside are excluded
  Why: proves the filter is exclusive. A filter that returns everything
  trivially passes test 1. Test 2 catches that.

Test 3: antimeridian bbox — asset at lng=175 returned by bbox=170,35,-170,50
  Why: the OR branch (asset.lng >= minLng OR asset.lng <= maxLng) is the only
  non-obvious logic in the entire store. A wrong operator (AND instead of OR)
  or a confused condition produces a silently wrong result — the filter returns
  no assets instead of throwing. This test is the only way to catch it.
  A synthetic asset is inserted at lng=175 before the assertion.

Test 4: type AND status filters compose correctly
  Why: type=pipe&status=warning must return pipes that are warning, not
  (all pipes) OR (all warnings). AND vs OR composition is a common bug.

Test 5: POST /assets with missing `lat` → 400
  Why: proves server validation catches missing required fields on the
  write path. The trust boundary test.

Test 6: POST /assets with lat: 999 → 400
  Why: proves coordinate range validation. A missing field and an invalid
  value are different validation paths — both must be covered.

Test 7: PATCH /assets/:id with unknown id → 404
  Why: proves not-found handling on mutations, not just reads. The error
  handler must normalize this — it should not be a 500.

Test 8: DELETE /assets/:id → 204, then GET /assets/:id → 404
  Why: proves the deletion is durable within the session. The compound
  test (delete then read) is more meaningful than just checking the
  204 status code.
```

### What is NOT tested and why

```
GET /assets returns 200                 → noise. Tests the framework, not the app.
Pagination math                         → arithmetic. Low risk, high confidence.
React component rendering               → jsdom + mocked Leaflet = high cost,
                                          low signal. geospatial logic is on the server.
CORS headers                            → infrastructure. Trivially verified by running
                                          the app.
Seed data count                         → fragile. Changes if seed.json changes.
```

### What the tests prove collectively

The 8 tests cover: the geospatial filter is correct for normal boxes (tests 1+2), the
antimeridian OR branch is correct (test 3), filter composition is correct (test 4), server
validation is enforced (tests 5+6), not-found handling is normalized (test 7), and
mutations are durable (test 8). These are the invariants the assignment is designed to
evaluate. Happy path plumbing is left untested deliberately — the app either runs or it
does not.

## Decision Summary

Decision

Chosen

Key reason

Primary tradeoff

Storage

In-memory

Frees time for evaluated areas

Data lost on restart

Geospatial filter

Bounding box + antimeridian

Maps to viewport naturally; OR logic handles ±180° wrap

No radius/polygon support

Filter placement

Inside store layer

Correct pagination, swappable

Slightly more complex store

Map library

Leaflet / react-leaflet

No API key, zero reviewer friction

Raster tiles, older API

API style

REST

Inspectable with curl, widely understood

More endpoints than GraphQL

API versioning

None (`/assets`)

No external clients exist

Harder to add prefix later

Edit verb

PATCH

Partial update matches form UX

Server must merge fields

Pagination

Offset / page

Simple, matches numbered UI

Page drift on frequent inserts

Map query

Separate hook, limit=500

All markers visible; list paginates independently

Two queries instead of one

Shared types

`shared/` directory + ts paths

Zero tooling overhead

Three alias config points required

Validation

Zod in `shared/`

Same schema on both sides

Zod as a dependency on client

Error classes

NotFoundError + ValidationError

Two classes cover all cases

No 422 distinction

State management

TanStack Query + useState

Right-sized for this scope

No offline support

Service layer

None (controllers → store)

No business logic exists yet

Add when first rule appears

App/server split

`app.ts` + `server.ts`

Supertest requires no-listen export

One extra file

Test runner

Vitest + Supertest

Fast, native ESM, real HTTP

No DOM tests

Tests count

8 targeted

Quality signal over quantity

Low coverage percentage

Test isolation

`beforeEach` re-seed

Prevents order-dependent failures

Slight overhead per test

Error handling

Typed AppError classes

Machine-readable codes

More boilerplate than strings

Project structure

Two packages + shared/

Simple, reviewer-friendly

Not a real npm workspace

UUID generation

`crypto.randomUUID()` in store

Store owns identity; no client-provided IDs

None

Seed path

`new URL(..., import.meta.url)`

ESM-safe; `__dirname` unavailable in ESM

Slightly less familiar pattern

STATUS_COLORS

`client/src/lib/constants.ts`

Single source; prevents marker/list drift

One more import
