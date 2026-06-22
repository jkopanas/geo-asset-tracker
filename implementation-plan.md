# Geo Asset Tracker — Implementation Plan

Each task is an atomic unit Claude Code can implement in a single session without needing
to revisit earlier tasks. Tasks are ordered so every dependency exists before it is needed.
Some groups can be parallelized — those are noted.

---

## Dependency Graph

```
T01 (root scaffolding)
 ├── T02 (shared schemas + types)
 │    ├── T05 (error classes)           ─┐
 │    ├── T06 (validate middleware)      │ can parallelize
 │    ├── T07 (error handler)           ─┘
 │    └── T08 (store interface)
 │         └── T09 (MemoryStore)
 │              └── T10 (routes + controllers)
 │                   └── T11 (app.ts + server.ts)
 │                        └── T12 (integration tests)
 │
 ├── T03 (api package init)  ─┐ parallel
 └── T04 (client package)   ─┘
      └── T13 (client entry + App skeleton)
           └── T14 (api.ts + constants)
                └── T15 (hooks)
                     ├── T16 (AssetMap + AssetMarker)  ─┐
                     ├── T17 (FilterBar)                │ parallel
                     ├── T18 (AssetList + AssetListItem)│
                     ├── T19 (AssetDetail)              │
                     └── T20 (LocationPicker)          ─┘
                          └── T21 (AssetForm)
                               └── T22 (wire App.tsx)
                                    └── T23 (README)
```

---

## Phase 0 — Scaffolding

---

### T01 — Root scaffolding

**What it does:** Create the top-level directory structure, root `package.json`, and
a root `.gitignore`. No application code.

**Reference inputs:**
- [architecture.md](./architecture.md) — project structure section

**Code inputs:** none (first task)

**Outputs:**
```
package.json              ← root, scripts only (install + dev + build)
.gitignore                ← node_modules, dist, .env
api/                      ← empty directory
client/                   ← empty directory
shared/                   ← empty directory
```

Root `package.json` shape (scripts only, no source):
```json
{
  "name": "geo-asset-tracker",
  "private": true,
  "scripts": {
    "dev":   "concurrently \"npm run dev --prefix api\" \"npm run dev --prefix client\"",
    "build": "npm run build --prefix api && npm run build --prefix client",
    "install:all": "npm install && npm install --prefix api && npm install --prefix client"
  },
  "devDependencies": {
    "concurrently": "^8.2.0"
  }
}
```

**Dependencies:** none

**Acceptance criteria:**
- `ls` at repo root shows `api/`, `client/`, `shared/`, `package.json`, `.gitignore`, `seed.json`
- `npm install` at root installs `concurrently` without error

---

### T02 — Shared schemas and types

**What it does:** Create the two files in `shared/` that are the single source of truth
for all types and validation logic. TypeScript types are inferred from Zod schemas — they
are never written by hand in `types.ts`.

**Reference inputs:**
- [data-model.md](./data-model.md) — schema inventory, constraint summary, all types
- [api-contracts.md](./api-contracts.md) — validation rules per field

**Code inputs:** T01 (directory exists)

**Outputs:**
```
shared/schemas.ts    ← all Zod schemas
shared/types.ts      ← z.infer<typeof Schema> exports, AssetStore interface types
```

**`shared/schemas.ts` must define (in this order):**

1. `AssetTypeSchema` — `z.enum(['pipe', 'hydrant', 'sensor', 'valve'])`
2. `AssetStatusSchema` — `z.enum(['ok', 'warning', 'critical'])`
3. `IsoDateSchema` — `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` — extracted as a named schema so all three date fields share one regex
4. `AssetSchema` — full asset object; use `IsoDateSchema` for `installed_at` and `IsoDateSchema.nullable()` for `last_inspected_at`
5. `CreateAssetSchema` — required fields + optional `last_inspected_at` (nullable, default null) + optional `notes` (default `""`). Include explicit error messages: `z.string().min(1, 'Required.')`, `z.number({ required_error: 'Required.' }).min(-90).max(90)` — these strings become the `fields` values in `ValidationError` responses
6. `UpdateAssetSchema` — all fields optional, no defaults. Write as `z.object({ ... })` with each field `.optional()`, not `CreateAssetSchema.partial()` — partial() would inherit the defaults from step 5, which must not apply on PATCH
7. `BBoxSchema` — takes a `z.string()`, splits on `,`, parses 4 floats, validates ranges (lat ±90, lng ±180, minLat ≤ maxLat), outputs `{ minLng, minLat, maxLng, maxLat }`
8. `AssetQuerySchema` — see implementation note below for the correct array-coerce pattern
9. `PaginationMetaSchema`, `AssetListResponseSchema`, `SingleAssetResponseSchema`, `ErrorResponseSchema`

**Critical implementation notes:**
- `IsoDateSchema`: define once, use everywhere. Do not inline the regex in `AssetSchema`, `CreateAssetSchema`, and `UpdateAssetSchema` separately.
- `BBoxSchema` refinement: `minLat <= maxLat` must be a `.refine()` on the output object. `minLng > maxLng` is explicitly **not** an error.
- `AssetQuerySchema` — use `union + transform` (not `z.preprocess`) for type/status array coercion. Express sends `?type=pipe` as a string and `?type=pipe&type=valve` as an array. The correct pattern:
  ```ts
  z.union([AssetTypeSchema, z.array(AssetTypeSchema)])
    .optional()
    .transform((v) => (v === undefined ? undefined : [v].flat()))
  ```
  `z.preprocess` bypasses Zod's type inference and forces you to cast the output. The union+transform keeps TypeScript happy without casts.
- `AssetQuery` inferred type: `page` and `limit` must be `number` (not `number | undefined`). `.default(1)` means Zod guarantees the value is always present. If the interface shows `page?: number`, the controller has to null-check a value that can never be undefined at runtime.
- `UpdateAssetSchema`: `last_inspected_at` when present can be `null` (clear) or a date string (update). When absent (field not in body), the field is not changed. Use `.optional()` after `.nullable()` to represent all three states.
- Install `zod` in `shared/` by including it as a dependency in both `api/package.json` and `client/package.json` (shared/ is not a package — it is imported via path alias).

**`shared/types.ts` must export:**
- `AssetType` = `z.infer<typeof AssetTypeSchema>`
- `AssetStatus` = `z.infer<typeof AssetStatusSchema>`
- `Asset` = `z.infer<typeof AssetSchema>`
- `CreateAssetInput` = `z.infer<typeof CreateAssetSchema>`
- `UpdateAssetInput` = `z.infer<typeof UpdateAssetSchema>`
- `BBox` = output type of BBoxSchema (object with 4 number fields)
- `AssetQuery` = `z.infer<typeof AssetQuerySchema>`
- `PaginationMeta`, `AssetListResponse`, `SingleAssetResponse`, `ErrorResponse`

**Dependencies:** T01

**Acceptance criteria:**
- `shared/schemas.ts` and `shared/types.ts` are valid TypeScript (no `tsc` errors when checked standalone)
- `BBoxSchema.parse("170,35,-170,50")` returns `{ minLng: 170, minLat: 35, maxLng: -170, maxLat: 50 }` (antimeridian — valid)
- `BBoxSchema.parse("0,50,10,40")` throws (minLat > maxLat — invalid)
- `AssetQuerySchema.parse({ page: '2', limit: '25' })` returns `{ page: 2, limit: 25 }` where both values are `number` type (not `number | undefined`)
- `AssetQuerySchema.parse({ type: 'pipe' })` returns `{ type: ['pipe'], page: 1, limit: 25 }` (string coerced to array)
- `AssetQuerySchema.parse({ type: ['pipe', 'valve'] })` returns `{ type: ['pipe', 'valve'], page: 1, limit: 25 }` (array passed through)
- `UpdateAssetSchema.parse({})` returns `{}` (valid empty patch)
- `UpdateAssetSchema.parse({ last_inspected_at: null })` returns `{ last_inspected_at: null }` (clear field)
- `CreateAssetSchema.safeParse({ name: '' }).error.flatten().fieldErrors.name[0]` contains `"Required."` (error messages flow through)

---

## Phase 1 — API Package

---

### T03 — API package initialization

**What it does:** Set up the `api/` package with all dependencies, `tsconfig.json`, and
the vitest config. No source files.

**Reference inputs:**
- [architecture.md](./architecture.md) — backend stack, ESM notes, Supertest rationale

**Code inputs:** T01 (directory exists)

**Outputs:**
```
api/package.json
api/tsconfig.json
api/vitest.config.ts
```

**`api/package.json`:**
```json
{
  "name": "geo-asset-tracker-api",
  "type": "module",
  "scripts": {
    "dev":       "tsx watch src/server.ts",
    "build":     "tsc",
    "start":     "node dist/server.js",
    "test":      "vitest run",
    "test:watch":"vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "cors":    "^2.8.5",
    "express": "^4.18.2",
    "zod":     "^3.22.4"
  },
  "devDependencies": {
    "@types/cors":       "^2.8.17",
    "@types/express":    "^4.17.21",
    "@types/supertest":  "^6.0.2",
    "supertest":         "^6.3.4",
    "tsx":               "^4.7.0",
    "typescript":        "^5.3.3",
    "vitest":            "^1.2.0"
  }
}
```

**`api/tsconfig.json`:**
```json
{
  "compilerOptions": {
    "target":            "ES2022",
    "module":            "Node16",
    "moduleResolution":  "Node16",
    "outDir":            "./dist",
    "rootDir":           "./src",
    "strict":            true,
    "esModuleInterop":   true,
    "skipLibCheck":      true,
    "paths": {
      "@shared/*": ["../shared/*"]
    }
  },
  "include": ["src/**/*", "tests/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**`api/vitest.config.ts`:**
```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { environment: 'node' }
});
```

**Dependencies:** T01

**Acceptance criteria:**
- `npm install` inside `api/` exits 0
- `npx tsc --noEmit` inside `api/` exits 0 (even with no source yet — empty `src/` is fine)

---

### T04 — Client package initialization

**What it does:** Set up the `client/` package with all dependencies, `tsconfig.json`,
`vite.config.ts`, and `index.html`. No source files yet.

**Reference inputs:**
- [architecture.md](./architecture.md) — frontend stack, shared alias 3-config-point note

**Code inputs:** T01 (directory exists)

**Outputs:**
```
client/package.json
client/tsconfig.json
client/vite.config.ts
client/index.html
```

**`client/package.json`:**
```json
{
  "name": "geo-asset-tracker-client",
  "type": "module",
  "scripts": {
    "dev":       "vite",
    "build":     "tsc && vite build",
    "preview":   "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@hookform/resolvers": "^3.3.4",
    "@tanstack/react-query":"^5.17.9",
    "leaflet":             "^1.9.4",
    "react":               "^18.2.0",
    "react-dom":           "^18.2.0",
    "react-hook-form":     "^7.49.3",
    "react-leaflet":       "^4.2.1",
    "zod":                 "^3.22.4"
  },
  "devDependencies": {
    "@types/leaflet":      "^1.9.8",
    "@types/react":        "^18.2.48",
    "@types/react-dom":    "^18.2.18",
    "@vitejs/plugin-react":"^4.2.1",
    "typescript":          "^5.3.3",
    "vite":                "^5.0.11"
  }
}
```

**`client/tsconfig.json`:**
```json
{
  "compilerOptions": {
    "target":            "ES2020",
    "module":            "ESNext",
    "moduleResolution":  "Bundler",
    "jsx":               "react-jsx",
    "strict":            true,
    "esModuleInterop":   true,
    "skipLibCheck":      true,
    "paths": {
      "@shared/*": ["../shared/*"]
    }
  },
  "include": ["src"]
}
```

**`client/vite.config.ts`:**
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared')
    }
  }
});
```

**`client/index.html`:** Standard Vite HTML template with `<div id="root">` and script
pointing to `src/main.tsx`.

**Dependencies:** T01

**Acceptance criteria:**
- `npm install` inside `client/` exits 0
- `npx tsc --noEmit` inside `client/` exits 0 (with no source yet)
- `npm run dev` starts the Vite dev server on port 5173

---

### T05 — Error classes

**What it does:** Define the three error classes used throughout the backend.

**Reference inputs:**
- [architecture.md](./architecture.md) — error class hierarchy section
- [data-model.md](./data-model.md) — error types, ApiError shape

**Code inputs:** T03 (`api/` package exists)

**Outputs:**
```
api/src/errors/app-errors.ts
```

**Class structure:**
```
AppError (extends Error)
  statusCode: number
  code: string
  constructor(statusCode, code, message)

NotFoundError (extends AppError)
  statusCode: 404
  code: 'NOT_FOUND'
  constructor(id: string)
  message: "No asset with id '{id}' exists."

ValidationError (extends AppError)
  statusCode: 400
  code: 'VALIDATION_ERROR'
  fields?: Record<string, string>
  constructor(message: string, fields?: Record<string, string>)
```

**Dependencies:** T03

**Acceptance criteria:**
- TypeScript compiles without errors
- `new NotFoundError('abc').statusCode === 404`
- `new ValidationError('invalid', { lat: 'out of range' }).fields` returns the fields object
- `new ValidationError('invalid') instanceof AppError === true`

---

### T06 — Validate middleware

**What it does:** Create a middleware factory that validates `req.body` or `req.query`
against a Zod schema and sets `req.validated` on success.

**Reference inputs:**
- [architecture.md](./architecture.md) — validate() section in request lifecycle diagram

**Code inputs:** T05 (ValidationError), T02 (Zod schemas are the input type)

**Outputs:**
```
api/src/middleware/validate.ts
```

**Behavior:**
- Signature: `validate(schema: ZodSchema, source: 'body' | 'query' = 'body')`
- Returns an Express `RequestHandler`
- Calls `schema.safeParse(req[source])`
- On failure: collects Zod field errors into `Record<string, string>` (use `error.flatten().fieldErrors`), throws `new ValidationError('Request body is invalid.', fields)`
- On success: sets `req.validated = result.data`, calls `next()`

**TypeScript augmentation** (must be in this file or a `.d.ts`):
```typescript
declare global {
  namespace Express {
    interface Request {
      validated: unknown;
    }
  }
}
```

**Dependencies:** T05

**Acceptance criteria:**
- TypeScript compiles without errors
- When called with a schema that requires `name: string` and body is `{}`, the middleware throws a `ValidationError` with `fields.name` populated
- When schema parses successfully, `req.validated` is set to the parsed (coerced) value

---

### T07 — Error handler middleware

**What it does:** Express 4-argument error handler that maps error classes to HTTP
responses. Installed last in the middleware chain.

**Reference inputs:**
- [architecture.md](./architecture.md) — error handler middleware flowchart
- [api-contracts.md](./api-contracts.md) — error response envelope shape

**Code inputs:** T05 (AppError, ValidationError)

**Outputs:**
```
api/src/middleware/error.ts
```

**Behavior:**
- 4-argument signature: `(err, req, res, next)`
- If `err instanceof AppError`: use `err.statusCode`, `err.code`, `err.message`
- If `err instanceof ValidationError`: include `err.fields` in response body
- Otherwise: `statusCode = 500`, `code = 'INTERNAL_ERROR'`, `message = 'An unexpected error occurred.'`
- Always: `console.error(err)` (log the real error server-side)
- Never: include stack trace in response body
- Response shape: `{ error: { code, message, fields? } }`

**Dependencies:** T05

**Acceptance criteria:**
- TypeScript compiles
- Given a `NotFoundError`, handler sends `{ error: { code: 'NOT_FOUND', ... } }` with status 404
- Given a `ValidationError` with fields, handler sends the `fields` key in the error object
- Given an unknown `Error`, handler sends status 500 and does not include the stack

---

### T08 — Asset store interface

**What it does:** Define the `AssetStore` interface and the api-only types `AssetFilters`
and `AssetPage` that the store and controllers agree on.

**Reference inputs:**
- [data-model.md](./data-model.md) — AssetStore interface section, AssetFilters, AssetPage

**Code inputs:** T02 (Asset, AssetType, AssetStatus, BBox, CreateAssetInput, UpdateAssetInput), T03

**Outputs:**
```
api/src/store/asset-store.ts
```

**Contents:**
```typescript
// AssetFilters — what store.findAll receives
// AssetPage — what store.findAll returns
// AssetStore — the interface any implementation must satisfy
```

Methods (all return Promises to keep the interface swappable with async implementations):
- `findAll(filters: AssetFilters): Promise<AssetPage>`
- `findById(id: string): Promise<Asset | null>`
- `create(input: CreateAssetInput): Promise<Asset>`
- `update(id: string, patch: UpdateAssetInput): Promise<Asset | null>`
- `delete(id: string): Promise<boolean>`
- `seed(assets: Asset[]): Promise<void>`

**Dependencies:** T02, T03

**Acceptance criteria:**
- TypeScript compiles
- Interface is exported and importable by the store implementation and app.ts

---

### T09 — MemoryStore implementation

**What it does:** Implement `AssetStore` using an in-memory `Map<string, Asset>`.
This is the most logic-heavy backend task — the geospatial filter and PATCH merge
semantics live here.

**Reference inputs:**
- [architecture.md](./architecture.md) — bounding box + antimeridian logic, filter order, PATCH semantics
- [data-model.md](./data-model.md) — AssetStore methods, null semantics for UpdateAssetInput

**Code inputs:** T08 (AssetStore interface), T02 (types)

**Outputs:**
```
api/src/store/memory.store.ts
```

**Critical implementation details:**

**`findAll` filter pipeline (must apply in this order):**
1. Start with all values from the Map
2. If `filters.types` is set: keep assets where `filters.types.includes(asset.type)`
3. If `filters.statuses` is set: keep assets where `filters.statuses.includes(asset.status)`
4. If `filters.bbox` is set: apply lat AND lng check:
   - Lat: `asset.lat >= bbox.minLat && asset.lat <= bbox.maxLat`
   - Lng (Case A, normal): if `bbox.minLng <= bbox.maxLng`: `asset.lng >= bbox.minLng && asset.lng <= bbox.maxLng`
   - Lng (Case B, antimeridian): if `bbox.minLng > bbox.maxLng`: `asset.lng >= bbox.minLng || asset.lng <= bbox.maxLng`
5. Record `total = filtered.length` (this is pre-pagination total)
6. Slice: `filtered.slice((page - 1) * limit, page * limit)`
7. Return `{ assets: sliced, total }`

**`create`:**
- Generate `id = crypto.randomUUID()`
- Apply defaults: `last_inspected_at: input.last_inspected_at ?? null`, `notes: input.notes ?? ''`
- Store in Map, return full Asset

**`update`:**
- Return `null` if id not in Map
- Build the updated asset by spreading the existing asset and only applying keys
  that are **present** in the patch object: check `key in patch`, not `patch[key] !== undefined`
  (these are different — `null` is a valid value and means "clear the field")
- Return the updated asset

**`delete`:** Return `false` if id not in Map; delete and return `true`

**`seed`:** Clear the Map, insert all provided assets

**Dependencies:** T08

**Acceptance criteria:**
- TypeScript compiles
- `findAll({ page: 1, limit: 25 })` with 150 seeded assets returns `{ assets: [...25 items], total: 150 }`
- `findAll({ bbox: { minLng: 170, minLat: 35, maxLng: -170, maxLat: 50 }, page: 1, limit: 500 })` returns an asset at `lng: 175, lat: 42` (antimeridian OR case)
- `findAll({ bbox: { minLng: 170, minLat: 35, maxLng: -170, maxLat: 50 }, page: 1, limit: 500 })` does NOT return an asset at `lng: 0, lat: 42` (outside the box)
- `update(id, {})` returns the asset unchanged
- `update(id, { last_inspected_at: null })` sets `last_inspected_at` to null
- `update('nonexistent', {})` returns null

---

### T10 — Asset routes and controllers

**What it does:** Implement the 5 REST endpoints. Routes apply the correct validate()
middleware. Controllers read `req.validated`, call the store, and format the response.

**Reference inputs:**
- [api-contracts.md](./api-contracts.md) — all endpoints, status codes, response shapes
- [architecture.md](./architecture.md) — request lifecycle diagram

**Code inputs:** T05 (errors), T06 (validate), T08 (store interface), T09 (MemoryStore),
T02 (schemas, types)

**Outputs:**
```
api/src/routes/assets.ts
api/src/controllers/assets.controller.ts
```

**Routes (`api/src/routes/assets.ts`):**
- Receives the store as a constructor argument or as a module import
- `GET    /`      → `validate(AssetQuerySchema, 'query')` → `listAssets`
- `GET    /:id`   → `getAsset`
- `POST   /`      → `validate(CreateAssetSchema, 'body')` → `createAsset`
- `PATCH  /:id`   → `validate(UpdateAssetSchema, 'body')` → `updateAsset`
- `DELETE /:id`   → `deleteAsset`

**Controllers (`api/src/controllers/assets.controller.ts`):**

`listAssets`:
- Read `req.validated as AssetQuery`
- Map to `AssetFilters`: `{ types: query.type, statuses: query.status, bbox: query.bbox, page: query.page, limit: query.limit }`
- Call `store.findAll(filters)`
- Return `200` with `{ data: assets, meta: { total, page, limit, pages: Math.ceil(total / limit) || 0 } }`

`getAsset`:
- Read `req.params.id`
- Call `store.findById(id)`
- If null: `throw new NotFoundError(id)`
- Return `200` with `{ data: asset }`

`createAsset`:
- Read `req.validated as CreateAssetInput`
- Call `store.create(input)`
- Return `201` with header `Location: /assets/${asset.id}` and body `{ data: asset }`

`updateAsset`:
- Read `req.params.id` and `req.validated as UpdateAssetInput`
- Call `store.update(id, patch)`
- If null: `throw new NotFoundError(id)`
- Return `200` with `{ data: asset }`

`deleteAsset`:
- Read `req.params.id`
- Call `store.delete(id)`
- If false: `throw new NotFoundError(id)`
- Return `204` with no body: `res.status(204).end()`

**Dependencies:** T05, T06, T08, T09, T02

**Acceptance criteria:**
- TypeScript compiles with no errors
- `createAsset` controller calls `res.status(201).location(...)` not `res.status(200)`
- `deleteAsset` controller calls `res.status(204).end()` with no JSON body
- All controllers cast `req.validated` to the correct type before use

---

### T11 — Express app wiring

**What it does:** Assemble the Express application and create the server entry point.
This is the last backend task before tests.

**Reference inputs:**
- [architecture.md](./architecture.md) — request lifecycle, app/server split rationale, CORS config, seed path (ESM)

**Code inputs:** T06, T07, T09, T10

**Outputs:**
```
api/src/app.ts
api/src/server.ts
```

**`api/src/app.ts`:**
```typescript
// Create and configure Express app — exported with no listen() call
// Also export: store (MemoryStore instance) so tests can call store.seed()

import express from 'express';
import cors from 'cors';
import { assetRouter } from './routes/assets.js';
import { errorHandler } from './middleware/error.js';
import { MemoryStore } from './store/memory.store.js';

export const store = new MemoryStore();

const app = express();

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());
app.use((req, _, next) => { console.log(`${req.method} ${req.path}`); next(); });
app.use('/assets', assetRouter(store));
app.use(errorHandler);

export default app;
```

**`api/src/server.ts`:**
```typescript
// Entry point: seed data, then start listening
// Uses ESM-safe path for seed.json

import { readFileSync } from 'fs';
import app, { store } from './app.js';

const seedUrl = new URL('../../seed.json', import.meta.url);
const seedData = JSON.parse(readFileSync(seedUrl, 'utf-8'));
await store.seed(seedData);

app.listen(3000, () => {
  console.log('API running on http://localhost:3000');
});
```

**Critical notes:**
- Import paths must include `.js` extension (Node16 ESM resolution)
- `new URL('../../seed.json', import.meta.url)` — not `__dirname`, not `path.join`
- `errorHandler` must be the **last** `app.use()` call

**Dependencies:** T06, T07, T09, T10

**Acceptance criteria:**
- `npm run dev` inside `api/` starts without error
- `curl http://localhost:3000/assets` returns `{ data: [...], meta: { total: 150, ... } }`
- `curl http://localhost:3000/assets/nonexistent` returns `{ error: { code: 'NOT_FOUND', ... } }` with status 404
- `curl -X POST http://localhost:3000/assets -H 'Content-Type: application/json' -d '{}'` returns 400 with `fields`

---

### T12 — Integration tests

**What it does:** Write the 8 integration tests using Vitest + Supertest. These are the
tests the reviewer will run to evaluate the application's correctness.

**Reference inputs:**
- [architecture.md](./architecture.md) — test strategy section, all 8 test descriptions

**Code inputs:** T11 (app.ts + store exports), T02 (types), seed.json

**Outputs:**
```
api/tests/assets.test.ts
```

**Test file structure:**
```typescript
import { beforeEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import { readFileSync } from 'fs';
import app, { store } from '../src/app.js';
import type { Asset } from '@shared/types.js';

const seedUrl = new URL('../../seed.json', import.meta.url);
const seedData: Asset[] = JSON.parse(readFileSync(seedUrl, 'utf-8'));

beforeEach(async () => {
  await store.seed(seedData);
});
```

**The 8 tests (exactly as specified in architecture.md):**

| # | Name | Setup | Request | Assert |
|---|------|-------|---------|--------|
| 1 | bbox inside → returned | Use a known seed asset's coordinates to build a tight bbox | `GET /assets?bbox=...` | Asset is in `data` array |
| 2 | bbox outside → excluded | bbox that excludes all seed assets | `GET /assets?bbox=...` | `data` is empty array |
| 3 | antimeridian bbox: asset at lng=175 | `store.create({ ..., lat: 42, lng: 175 })` within the test | `GET /assets?bbox=170,35,-170,50` | Created asset is in `data` |
| 4 | type AND status compose | — | `GET /assets?type=pipe&status=warning` | All returned assets have `type='pipe'` AND `status='warning'` |
| 5 | POST missing `lat` → 400 | — | `POST /assets` body without `lat` | Status 400, `error.code='VALIDATION_ERROR'`, `error.fields.lat` exists |
| 6 | POST `lat: 999` → 400 | — | `POST /assets` body with `lat: 999` | Status 400, `error.fields.lat` exists |
| 7 | PATCH unknown id → 404 | — | `PATCH /assets/00000000-0000-0000-0000-000000000000` | Status 404, `error.code='NOT_FOUND'` |
| 8 | DELETE then GET → 404 | — | `DELETE /assets/{seedId}` then `GET /assets/{seedId}` | First returns 204, second returns 404 |

**Test 3 implementation note:** Use `await store.create(...)` before making the Supertest
request. The created asset will be in the store for that test; `beforeEach` will clear it
for the next test.

**Test 8 implementation note:** Pick the first asset's id from `seedData[0].id`. Chain
two requests: one DELETE (assert 204) then one GET (assert 404).

**Dependencies:** T11

**Acceptance criteria:**
- `npm test` inside `api/` exits 0
- All 8 tests pass
- Tests are not order-dependent (run `npm test -- --reporter=verbose` and shuffle order mentally)

---

## Phase 2 — Client Foundation

---

### T13 — Client entry point and App skeleton

**What it does:** Create `main.tsx` (entry), `App.tsx` (root state), and wire up
QueryClientProvider. All state variables are declared; no UI yet.

**Reference inputs:**
- [architecture.md](./architecture.md) — state ownership table, state flow diagram, component tree

**Code inputs:** T04 (client package), T02 (AssetType, AssetStatus, BBox)

**Outputs:**
```
client/src/main.tsx
client/src/App.tsx
```

**`main.tsx`:**
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.js';
import 'leaflet/dist/leaflet.css';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
```

**`App.tsx` state (declare all; render null or a placeholder for now):**
```typescript
const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
const [filters, setFilters] = useState<{ type: AssetType[]; status: AssetStatus[] }>
  ({ type: [], status: [] });
const [bbox, setBbox] = useState<BBox | undefined>(undefined);
const [page, setPage] = useState(1);
```

**Critical notes:**
- `import 'leaflet/dist/leaflet.css'` must be in `main.tsx` — Leaflet needs its CSS to
  render correctly; without it, tiles render with z-index issues and controls are invisible.
- The state setters will be passed as props to child components in T22.

**Dependencies:** T04, T02

**Acceptance criteria:**
- `npm run dev` inside `client/` starts without TypeScript error
- Browser shows no console errors (blank page with placeholder text is fine)
- Leaflet CSS is loaded (check Network tab)

---

### T14 — API client and constants

**What it does:** Create the typed fetch wrapper (`api.ts`) and the `STATUS_COLORS`
constant. These are imported by all hooks and components.

**Reference inputs:**
- [api-contracts.md](./api-contracts.md) — base URL, error response shape, all endpoint signatures
- [data-model.md](./data-model.md) — STATUS_COLORS, AssetStatus

**Code inputs:** T04, T02 (response types, AssetStatus)

**Outputs:**
```
client/src/lib/api.ts
client/src/lib/constants.ts
```

**`api.ts`:**
```typescript
// Base URL: 'http://localhost:3000'
// Typed fetch helper: fetches JSON, throws parsed { error } on non-2xx
// Exports individual functions for each endpoint:
//   getAssets(params: AssetQuery): Promise<AssetListResponse>
//   getAsset(id: string): Promise<SingleAssetResponse>
//   createAsset(body: CreateAssetInput): Promise<SingleAssetResponse>
//   updateAsset(id: string, body: UpdateAssetInput): Promise<SingleAssetResponse>
//   deleteAsset(id: string): Promise<void>
```

The `getAssets` function must serialize `AssetQuery` to a URL query string:
- `type` and `status` arrays must be serialized as repeated params (`?type=pipe&type=valve`)
- `bbox` must be serialized as `minLng,minLat,maxLng,maxLat`
- `page` and `limit` are always included

On non-2xx response: parse the body as `ErrorResponse` and throw with the parsed error
shape so hooks can display the message.

**`constants.ts`:**
```typescript
export const STATUS_COLORS: Record<AssetStatus, string> = {
  ok:       '#22c55e',
  warning:  '#f59e0b',
  critical: '#ef4444',
};
```

**Dependencies:** T04, T02

**Acceptance criteria:**
- TypeScript compiles
- `getAssets({ type: ['pipe', 'valve'], status: [], page: 1, limit: 25 })` builds URL `?type=pipe&type=valve&page=1&limit=25`
- `STATUS_COLORS.ok === '#22c55e'`

---

### T15 — Data hooks

**What it does:** Create the four TanStack Query hooks. The query cache key structure
must be consistent so mutations can invalidate the right queries.

**Reference inputs:**
- [architecture.md](./architecture.md) — hooks section, useAsset initialData pattern, cache invalidation

**Code inputs:** T14 (api.ts), T02 (types)

**Outputs:**
```
client/src/hooks/useMapAssets.ts
client/src/hooks/useAssets.ts
client/src/hooks/useAsset.ts
client/src/hooks/useAssetMutations.ts
```

**`useMapAssets.ts`:**
```typescript
// queryKey: ['mapAssets', filters, bbox]
// queryFn: getAssets({ ...filters, bbox, page: 1, limit: 500 })
// Returns UseQueryResult<AssetListResponse>
```

**`useAssets.ts`:**
```typescript
// queryKey: ['assets', filters, bbox, page]
// queryFn: getAssets({ ...filters, bbox, page, limit: 25 })
// Returns UseQueryResult<AssetListResponse>
```

**`useAsset.ts`:**
```typescript
// queryKey: ['asset', id]
// queryFn: getAsset(id) (only fires when id is truthy)
// initialData: () => queryClient.getQueryData<AssetListResponse>(['mapAssets', ...])?.data.find(a => a.id === id)
// enabled: !!id
```

Note: `useAsset` receives the current `filters` and `bbox` as additional arguments so it
can look up the correct map cache key for `initialData`. This avoids a network request
when the asset is already in the map cache.

**`useAssetMutations.ts`:**
```typescript
// Returns three mutations: createMutation, updateMutation, deleteMutation
// Each mutation's onSuccess calls:
//   queryClient.invalidateQueries({ queryKey: ['assets'] })
//   queryClient.invalidateQueries({ queryKey: ['mapAssets'] })
// updateMutation also invalidates: queryClient.invalidateQueries({ queryKey: ['asset', id] })
```

**Dependencies:** T14

**Acceptance criteria:**
- TypeScript compiles
- `useMapAssets` and `useAssets` have distinct query keys (different limit → different cache entry)
- `useAssetMutations` invalidates both `['assets']` and `['mapAssets']` on any mutation success

---

## Phase 3 — Client Components

Tasks T16–T20 all depend only on T15 and can be implemented in parallel.

---

### T16 — AssetMap and AssetMarker

**What it does:** The Leaflet map with markers. Emits bbox on viewport change (normalized).
Emits selected asset id on marker click.

**Reference inputs:**
- [architecture.md](./architecture.md) — AssetMap in component tree, bbox normalization formula, STATUS_COLORS usage

**Code inputs:** T15 (useMapAssets), T14 (constants.STATUS_COLORS), T02 (types)

**Outputs:**
```
client/src/components/AssetMap/AssetMap.tsx
client/src/components/AssetMap/AssetMarker.tsx
```

**`AssetMap.tsx` props:**
```typescript
{
  filters:            { type: AssetType[]; status: AssetStatus[] };
  bbox:               BBox | undefined;
  selectedAssetId:    string | null;
  onBboxChange:       (bbox: BBox) => void;    // called with setPage(1) co-located in App
  onSelectAsset:      (id: string) => void;
}
```

**Bbox normalization in `onMoveEnd`:**
```typescript
const normLng = (lng: number) => ((lng + 180) % 360) - 180;
// Get bounds from map.getBounds()
// Apply normLng to east and west
// Call onBboxChange({ minLng: normLng(west), minLat: south, maxLng: normLng(east), maxLat: north })
```

The map must use `MapContainer` with a `useMap` hook inside a child component to access
the Leaflet map instance for the `moveend` event listener (cannot call `useMap()` directly
in the `MapContainer` component).

**`AssetMarker.tsx` props:**
```typescript
{
  asset:         Asset;
  isSelected:    boolean;
  onSelect:      (id: string) => void;
}
```

Use `CircleMarker` from `react-leaflet`. Color: `STATUS_COLORS[asset.status]`. Selected
marker should have a slightly different `radius` or `fillOpacity` to provide visual
feedback.

**Dependencies:** T15, T14

**Acceptance criteria:**
- TypeScript compiles
- Map renders with markers color-coded by status
- Panning the map calls `onBboxChange` with normalized coordinates (no values outside [-180, 180])
- Clicking a marker calls `onSelectAsset(asset.id)`

---

### T17 — FilterBar

**What it does:** Checkboxes for asset type and asset status. Calls the update handler
for both. Page reset happens in App (not here).

**Reference inputs:**
- [architecture.md](./architecture.md) — FilterBar in component tree, co-located page reset

**Code inputs:** T02 (AssetType, AssetStatus)

**Outputs:**
```
client/src/components/FilterBar/FilterBar.tsx
```

**Props:**
```typescript
{
  filters: { type: AssetType[]; status: AssetStatus[] };
  onChange: (filters: { type: AssetType[]; status: AssetStatus[] }) => void;
}
```

Shows two checkbox groups: one for each `AssetType` value, one for each `AssetStatus`
value. Labels should be human-readable (capitalize: `pipe` → `Pipe`). An empty selection
means "all" — no type filter applied.

**Dependencies:** T02

**Acceptance criteria:**
- TypeScript compiles
- Toggling a checkbox calls `onChange` with the updated filters
- All 4 types and all 3 statuses are represented

---

### T18 — AssetList and AssetListItem

**What it does:** Paginated list of assets. Renders rows; clicking a row sets the
selected asset. Shows pagination controls.

**Reference inputs:**
- [architecture.md](./architecture.md) — AssetList in component tree, PaginationMeta

**Code inputs:** T15 (useAssets), T14 (STATUS_COLORS), T02 (types)

**Outputs:**
```
client/src/components/AssetList/AssetList.tsx
client/src/components/AssetList/AssetListItem.tsx
```

**`AssetList.tsx` props:**
```typescript
{
  filters:         { type: AssetType[]; status: AssetStatus[] };
  bbox:            BBox | undefined;
  page:            number;
  selectedAssetId: string | null;
  onSelectAsset:   (id: string) => void;
  onPageChange:    (page: number) => void;
}
```

Uses `useAssets(filters, bbox, page)`. Shows loading state while fetching. Shows error
state if query fails. Renders pagination controls using `meta.pages` and `meta.total`.

**`AssetListItem.tsx`:**
- Status color dot (small circle using `STATUS_COLORS[status]`)
- Asset name (bold)
- Type and status text
- Highlighted when `asset.id === selectedAssetId`
- `onClick` → `onSelectAsset(asset.id)`

**Dependencies:** T15, T14

**Acceptance criteria:**
- TypeScript compiles
- Pagination controls are hidden when `meta.pages <= 1`
- List updates when filters/bbox/page change
- Selected item is visually highlighted

---

### T19 — AssetDetail

**What it does:** Read-only panel showing a single asset's details. Opens when an asset
is selected. Uses `useAsset` with `initialData` from the map cache (no network request
when the asset is already visible on the map).

**Reference inputs:**
- [architecture.md](./architecture.md) — useAsset initialData pattern, AssetDetail in component tree

**Code inputs:** T15 (useAsset, useAssetMutations), T02 (types)

**Outputs:**
```
client/src/components/AssetDetail/AssetDetail.tsx
```

**Props:**
```typescript
{
  assetId:     string | null;
  filters:     { type: AssetType[]; status: AssetStatus[] };
  bbox:        BBox | undefined;
  onEdit:      (asset: Asset) => void;
  onClose:     () => void;
}
```

When `assetId` is null, renders nothing (or a placeholder).

Renders all asset fields. `last_inspected_at: null` should show "Never" or "—", not
"null". `notes: ""` should not render the notes section.

Includes:
- Edit button → `onEdit(asset)` (opens AssetForm in edit mode)
- Delete button → calls `deleteMutation.mutate(assetId)`, then `onClose()`

**Dependencies:** T15

**Acceptance criteria:**
- TypeScript compiles
- When `assetId` changes, the detail panel shows the new asset (from cache or network)
- `last_inspected_at: null` is displayed as a human-readable string, not "null"
- Delete calls the mutation and closes the panel on success

---

### T20 — LocationPicker

**What it does:** An embedded Leaflet map that lets the user click to set a lat/lng.
Used inside AssetForm. Knows nothing about the form — just calls `onLocationChange`.

**Reference inputs:**
- [architecture.md](./architecture.md) — LocationPicker sub-component rationale

**Code inputs:** T04 (leaflet installed), T02 (types)

**Outputs:**
```
client/src/components/AssetForm/LocationPicker.tsx
```

**Props:**
```typescript
{
  lat?:              number;
  lng?:              number;
  onLocationChange:  (lat: number, lng: number) => void;
}
```

Renders a `MapContainer`. On `click` event on the map, calls `onLocationChange(e.latlng.lat, e.latlng.lng)`. If `lat` and `lng` props are provided, renders a marker at that position.

The click handler must be inside a child component (not MapContainer itself) to access
the Leaflet map instance via `useMapEvents`.

**Dependencies:** T04

**Acceptance criteria:**
- TypeScript compiles
- Clicking the map calls `onLocationChange` with the clicked coordinates
- Existing lat/lng (if provided) shows a marker on the map

---

### T21 — AssetForm

**What it does:** Create and edit form. Single component — edit mode when an `asset`
prop is provided, create mode when it is absent. Uses React Hook Form + zodResolver.

**Reference inputs:**
- [api-contracts.md](./api-contracts.md) — POST body fields, PATCH body fields, field-level validation rules
- [architecture.md](./architecture.md) — AssetForm in component tree, single form rationale

**Code inputs:** T15 (useAssetMutations), T20 (LocationPicker), T02 (CreateAssetSchema, UpdateAssetSchema, types)

**Outputs:**
```
client/src/components/AssetForm/AssetForm.tsx
```

**Props:**
```typescript
{
  asset?:    Asset;   // undefined → create mode; provided → edit mode
  onSuccess: () => void;
  onCancel:  () => void;
}
```

**Implementation:**
- `useForm({ resolver: zodResolver(CreateAssetSchema), defaultValues: asset ?? defaultValues })`
- `LocationPicker` is embedded; its `onLocationChange` calls `setValue('lat', lat)` and `setValue('lng', lng)`
- On submit in create mode: `createMutation.mutate(data)` → on success, `onSuccess()`
- On submit in edit mode: `updateMutation.mutate({ id: asset.id, ...data })` → on success, `onSuccess()`
- Field errors are displayed inline beneath each field using `formState.errors`
- `last_inspected_at` field: text input (date type) + a "Clear" button that calls `setValue('last_inspected_at', null)`

**Critical note:** `zodResolver` with `CreateAssetSchema` for both modes means the PATCH
form has required fields that POST also has. This is acceptable — the edit form always
shows all fields pre-populated with existing values. A partial-update form would require
`UpdateAssetSchema` but managing partial vs. full form is more complex than the benefit
warrants.

**Dependencies:** T15, T20, T02

**Acceptance criteria:**
- TypeScript compiles
- In create mode: submitting an empty form shows validation errors for all required fields without making a network request
- In edit mode: fields are pre-populated with the existing asset's values
- Location picker updates `lat` and `lng` in the form
- Successful create/edit calls `onSuccess()`

---

## Phase 4 — Wiring and Delivery

---

### T22 — Wire App.tsx

**What it does:** Complete `App.tsx` with all state, all component composition, and the
correct handler implementations (including co-located page resets).

**Reference inputs:**
- [architecture.md](./architecture.md) — full component tree, state ownership table, state flow diagram, co-located reset note

**Code inputs:** T16, T17, T18, T19, T21 (all components), T15

**Outputs:**
```
client/src/App.tsx   (replace skeleton from T13)
```

**State handler requirements:**

```typescript
// Filter change: reset page co-located (NOT in useEffect)
const handleFiltersChange = (next: Filters) => {
  setFilters(next);
  setPage(1);
};

// Bbox change: reset page co-located
const handleBboxChange = (next: BBox) => {
  setBbox(next);
  setPage(1);
};
```

**Component composition:**
```
<QueryClientProvider>
  <FilterBar filters={filters} onChange={handleFiltersChange} />
  <AssetMap
    filters={filters} bbox={bbox}
    selectedAssetId={selectedAssetId}
    onBboxChange={handleBboxChange}
    onSelectAsset={setSelectedAssetId}
  />
  <AssetList
    filters={filters} bbox={bbox} page={page}
    selectedAssetId={selectedAssetId}
    onSelectAsset={setSelectedAssetId}
    onPageChange={setPage}
  />
  <AssetDetail
    assetId={selectedAssetId}
    filters={filters} bbox={bbox}
    onEdit={(asset) => setEditingAsset(asset)}
    onClose={() => setSelectedAssetId(null)}
  />
  {(showForm) && (
    <AssetForm
      asset={editingAsset}
      onSuccess={() => { setShowForm(false); setEditingAsset(undefined); }}
      onCancel={() => { setShowForm(false); setEditingAsset(undefined); }}
    />
  )}
</QueryClientProvider>
```

Additional state needed: `showForm: boolean`, `editingAsset: Asset | undefined`.

**Dependencies:** T16, T17, T18, T19, T21

**Acceptance criteria:**
- `npm run dev` starts both api and client (`npm run dev` at root)
- All 150 seed assets appear on the map as color-coded markers
- Filtering by type/status updates both the map and the list simultaneously
- Panning the map updates the list to show only in-viewport assets
- Clicking a marker shows AssetDetail
- Clicking Edit opens AssetForm pre-populated
- Saving the edit updates both the map marker and the list row
- Creating a new asset adds a marker to the map and a row to the list
- Deleting an asset removes it from map and list
- Page resets to 1 whenever filters or bbox change
- No console errors in the browser

---

### T23 — README

**What it does:** Write the project README. The reviewer reads this first.

**Reference inputs:**
- [assigment-analysis.md](./assigment-analysis.md) — reviewer expectations, in-memory storage explanation
- [architecture.md](./architecture.md) — decision summary table

**Code inputs:** completed project (T22 done)

**Outputs:**
```
README.md
```

**Required sections:**

1. **Prerequisites** — Node.js ≥ 20 (NVM recommended), no Docker required
2. **Running the project**
   ```bash
   npm run install:all
   npm run dev
   # API: http://localhost:3000
   # Client: http://localhost:5173
   ```
3. **Running tests**
   ```bash
   cd api && npm test
   ```
4. **Architecture overview** — one paragraph per key decision:
   - Why in-memory store (not Postgres)
   - Why bounding box (not radius)
   - Why separate map/list queries
   - Antimeridian support
5. **Known limitations** — data resets on restart; max 500 assets on map
6. **Design decisions** — point to `architecture.md` for full detail

**Dependencies:** T22

**Acceptance criteria:**
- A reviewer with Node ≥ 20 can follow the README to run the app from a fresh clone
- The in-memory storage choice is acknowledged and explained (not silent)
- The README does not contain "TODO" or placeholder text

---

## Implementation Order Summary

```
Sequential (must run in order):
T01 → T02 → T03 → T05 → T08 → T09 → T10 → T11 → T12

Can parallelize within phase:
  Phase 0: T03 and T04 in parallel (both depend on T01)
  Phase 1: T05, T06, T07 in parallel (all depend on T02 + T03)
  Phase 3: T16, T17, T18, T19, T20 in parallel (all depend on T15)

Client chain (sequential):
T04 → T13 → T14 → T15 → [parallel T16–T20] → T21 → T22 → T23
```

## Task Count and Estimated Scope

| Phase | Tasks | Notes |
|-------|-------|-------|
| 0 — Scaffolding | T01–T02 | First two tasks; no application logic |
| 1 — API | T03, T05–T12 | 9 tasks; heaviest logic in T09 and T12 |
| 2 — Client foundation | T04, T13–T15 | 4 tasks; hooks are straightforward |
| 3 — Components | T16–T21 | 6 tasks; parallelizable; T21 is the most complex |
| 4 — Wiring + delivery | T22–T23 | 2 tasks; T22 is integration work |

**Total: 23 tasks.** Each task is a single Claude Code session.
The critical path is T01 → T02 → T09 (MemoryStore + geospatial) → T11 → T12 (tests).
Implement that path first to de-risk the assignment's most evaluated features.
