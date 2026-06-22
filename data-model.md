# Geo Asset Tracker — Data Model

This document defines every type, interface, DTO, and schema used by the application.
It is the single source of truth for the shape of data at every layer:
the store, the API boundary, and the frontend client.

Types marked **[shared]** live in `shared/types.ts` and are imported by both `api/` and `client/`.
Types marked **[api]** live inside `api/src/` and are used only by the server.
Types marked **[client]** live inside `client/src/` and are used only by the browser.

---

## Type Ownership

```
shared/
  types.ts        ← Asset, AssetType, AssetStatus, all DTOs, all response shapes
  schemas.ts      ← Zod schemas (infer types.ts from these)

api/src/
  store/
    asset-store.ts   ← AssetFilters, AssetPage (store interface contract)

client/src/
  lib/
    constants.ts     ← STATUS_COLORS (UI concern, not a data model type)
```

The rule: if both sides need to agree on a shape, it goes in `shared/`.
If only one side needs it, it stays local.

---

## Primitive Enumerations

### `AssetType` [shared]

The physical category of the asset.

```typescript
type AssetType = "pipe" | "hydrant" | "sensor" | "valve";
```

| Value     | Description              |
| --------- | ------------------------ |
| `pipe`    | Underground pipe segment |
| `hydrant` | Fire hydrant             |
| `sensor`  | Environmental sensor     |
| `valve`   | Flow control valve       |

### `AssetStatus` [shared]

The current operational condition of the asset.

```typescript
type AssetStatus = "ok" | "warning" | "critical";
```

| Value      | Description                        |
| ---------- | ---------------------------------- |
| `ok`       | Operating normally                 |
| `warning`  | Requires attention, not yet urgent |
| `critical` | Immediate attention required       |

---

## Domain Model

### `Asset` [shared]

The canonical entity. This is the shape stored in the in-memory `Map` and returned by
every endpoint. All fields are always present in a response — there are no optional fields
in the returned asset shape (only in input shapes).

```typescript
interface Asset {
  id: string; // UUID v4, server-generated
  name: string; // non-empty string
  type: AssetType;
  status: AssetStatus;
  lat: number; // decimal degrees, range [-90, 90]
  lng: number; // decimal degrees, range [-180, 180]
  installed_at: string; // ISO 8601 date: YYYY-MM-DD
  last_inspected_at: string | null; // ISO 8601 date or null
  notes: string; // may be empty string ""
}
```

#### Field constraints

| Field               | Type             | Nullable | Constraints                                                           |
| ------------------- | ---------------- | -------- | --------------------------------------------------------------------- |
| `id`                | `string`         | No       | UUID v4 format. Server assigns on create. Never accepted from client. |
| `name`              | `string`         | No       | `length >= 1`                                                         |
| `type`              | `AssetType`      | No       | Enum — see above                                                      |
| `status`            | `AssetStatus`    | No       | Enum — see above                                                      |
| `lat`               | `number`         | No       | `-90 <= lat <= 90`                                                    |
| `lng`               | `number`         | No       | `-180 <= lng <= 180`                                                  |
| `installed_at`      | `string`         | No       | Matches `YYYY-MM-DD`                                                  |
| `last_inspected_at` | `string \| null` | Yes      | Matches `YYYY-MM-DD` or is `null`                                     |
| `notes`             | `string`         | No       | Empty string `""` is valid                                            |

---

## Input DTOs

DTOs describe what the client sends to the server. They are narrower than `Asset` —
they omit server-generated fields and make optional fields explicit.

### `CreateAssetInput` [shared]

Body shape for `POST /assets`. The server generates `id`. Fields with defaults are optional.

```typescript
interface CreateAssetInput {
  name: string;
  type: AssetType;
  status: AssetStatus;
  lat: number;
  lng: number;
  installed_at: string;
  last_inspected_at?: string | null; // defaults to null if absent
  notes?: string; // defaults to "" if absent
}
```

#### Field behavior on `POST`

| Field               | Required | Absent value behavior  |
| ------------------- | -------- | ---------------------- |
| `name`              | Yes      | → 400 VALIDATION_ERROR |
| `type`              | Yes      | → 400 VALIDATION_ERROR |
| `status`            | Yes      | → 400 VALIDATION_ERROR |
| `lat`               | Yes      | → 400 VALIDATION_ERROR |
| `lng`               | Yes      | → 400 VALIDATION_ERROR |
| `installed_at`      | Yes      | → 400 VALIDATION_ERROR |
| `last_inspected_at` | No       | Stored as `null`       |
| `notes`             | No       | Stored as `""`         |

Extra fields sent in the body are silently ignored.
The `id` field is ignored if sent — the server always generates a new UUID v4.

---

### `UpdateAssetInput` [shared]

Body shape for `PATCH /assets/:id`. Every field is optional.
Only fields present in the body are applied to the stored asset.
Fields absent from the body are left unchanged.

```typescript
interface UpdateAssetInput {
  name?: string;
  type?: AssetType;
  status?: AssetStatus;
  lat?: number;
  lng?: number;
  installed_at?: string;
  last_inspected_at?: string | null;
  notes?: string;
}
```

#### Null semantics — `last_inspected_at` on `PATCH`

This field has three distinct behaviors depending on how it appears in the body:

| Body value                    | Meaning                          |
| ----------------------------- | -------------------------------- |
| Field absent                  | Existing value is not changed    |
| Field present: `null`         | Field is set to `null` (cleared) |
| Field present: `"2025-06-22"` | Field is updated to that date    |

In TypeScript terms: the `?` in `last_inspected_at?` means the field can be **omitted
entirely** from the body object (no change), while `string | null` means when it **is**
present it can be a date string (update) or null (clear). These are two distinct states
that must not be conflated.

An empty body `{}` is valid — the asset is returned unchanged with `200 OK`.

---

## Query Types

These types represent the parsed form of `GET /assets` query parameters after validation
and coercion. The raw query string is a flat map of strings; these types are what the
validated, coerced values look like after passing through the Zod schema.

### `BBox` [shared]

A geographic bounding box in WGS84 decimal degrees.

```typescript
interface BBox {
  minLng: number; // westernmost longitude: -180 to 180
  minLat: number; // southernmost latitude: -90 to 90
  maxLng: number; // easternmost longitude: -180 to 180
  maxLat: number; // northernmost latitude: -90 to 90
}
```

The raw query string value `"-74.02,40.70,-73.93,40.78"` is parsed into:

```typescript
{
  minLng: -74.02,
  minLat:  40.70,
  maxLng: -73.93,
  maxLat:  40.78
}
```

**Antimeridian case:** when `minLng > maxLng`, the box crosses ±180° longitude.
This is valid — not a validation error. See the bounding box strategy in
[api-contracts.md](./api-contracts.md) for the inclusion logic.

**Constraint:** `minLat` must not exceed `maxLat`. A box where south > north is invalid.
A box where west > east is valid (antimeridian).

---

### `AssetQuery` [shared]

The parsed and validated shape of `GET /assets` query parameters.

```typescript
interface AssetQuery {
  type?: AssetType[]; // parsed from repeated ?type= params
  status?: AssetStatus[]; // parsed from repeated ?status= params
  bbox?: BBox; // parsed from ?bbox=minLng,minLat,maxLng,maxLat
  page: number; // integer >= 1, default: 1
  limit: number; // integer 1–500, default: 25
}
```

#### Raw-to-parsed coercion

| Raw query string        | Parsed value                                                 |
| ----------------------- | ------------------------------------------------------------ |
| `?type=pipe`            | `{ type: ['pipe'] }`                                         |
| `?type=pipe&type=valve` | `{ type: ['pipe', 'valve'] }`                                |
| `?status=warning`       | `{ status: ['warning'] }`                                    |
| (no type param)         | `{ type: undefined }`                                        |
| `?page=2`               | `{ page: 2 }`                                                |
| (no page param)         | `{ page: 1 }`                                                |
| (no limit param)        | `{ limit: 25 }`                                              |
| `?bbox=-74,40,-73,41`   | `{ bbox: { minLng:-74, minLat:40, maxLng:-73, maxLat:41 } }` |

The Zod `AssetQuerySchema` is responsible for this coercion. Raw Express `req.query`
contains strings only — the schema converts `"2"` → `2` for page/limit and
`"-74.02,40.70,-73.93,40.78"` → `BBox` for bbox.

---

### `AssetFilters` [api]

The shape passed to `AssetStore.findAll()`. This is the internal store contract,
not shared with the client.

```typescript
interface AssetFilters {
  types?: AssetType[];
  statuses?: AssetStatus[];
  bbox?: BBox;
  page: number;
  limit: number;
}
```

Note the field name difference from `AssetQuery`: `type` becomes `types`, `status`
becomes `statuses`. This avoids collision with JavaScript reserved words in some
contexts and makes the plurality explicit (these are always arrays internally).

The controller maps `AssetQuery → AssetFilters` before passing to the store.

---

## Store Interface Types

### `AssetPage` [api]

The return type of `AssetStore.findAll()`. Contains the paginated results and the
pre-pagination total for building `meta`.

```typescript
interface AssetPage {
  assets: Asset[];
  total: number; // count of all matching assets before pagination
}
```

The controller maps this to `AssetListResponse` by computing `pages = ceil(total / limit)`.

### `AssetStore` interface [api]

The complete store contract. Any implementation (`MemoryStore`, `PostgresStore`) must
satisfy this interface. No implementation details — just the method signatures.

```typescript
interface AssetStore {
  findAll(filters: AssetFilters): Promise<AssetPage>;
  findById(id: string): Promise<Asset | null>;
  create(input: CreateAssetInput): Promise<Asset>; // generates id internally
  update(id: string, patch: UpdateAssetInput): Promise<Asset | null>;
  delete(id: string): Promise<boolean>;
  seed(assets: Asset[]): Promise<void>; // clear + reload
}
```

`create` receives `CreateAssetInput` (no `id`). The store generates `id` via
`crypto.randomUUID()`. The caller never decides the id.

`update` returns `null` when the id does not exist. The controller converts this to
a `NotFoundError`. The store does not throw for not-found — it returns `null`.

`delete` returns `false` when the id does not exist. The controller converts `false`
to a `NotFoundError`.

---

## Response Types

### `PaginationMeta` [shared]

Pagination information included in every list response.

```typescript
interface PaginationMeta {
  total: number; // total matching assets before pagination
  page: number; // current page (1-indexed)
  limit: number; // page size
  pages: number; // ceil(total / limit); 0 when total is 0
}
```

#### `pages` edge cases

| total | limit | pages |
| ----- | ----- | ----- |
| 0     | 25    | 0     |
| 1     | 25    | 1     |
| 25    | 25    | 1     |
| 26    | 25    | 2     |
| 150   | 25    | 6     |
| 12    | 500   | 1     |

---

### `AssetListResponse` [shared]

The shape of a successful `GET /assets` response.

```typescript
interface AssetListResponse {
  data: Asset[];
  meta: PaginationMeta;
}
```

`data` is always an array — never `null`. When no assets match, `data` is `[]` and
`meta.total` is `0`.

---

### `SingleAssetResponse` [shared]

The shape of a successful `GET /assets/:id`, `POST /assets`, and `PATCH /assets/:id`
response.

```typescript
interface SingleAssetResponse {
  data: Asset;
}
```

---

## Error Types

### `ApiError` [shared]

The error object nested inside every error response.

```typescript
interface ApiError {
  code: string; // machine-readable error code
  message: string; // human-readable description
  fields?: Record<string, string>; // per-field messages, validation errors only
}
```

`fields` is only present on `VALIDATION_ERROR` responses. It is absent (not `null`,
not `{}`) for `NOT_FOUND` and `INTERNAL_ERROR`.

---

### `ErrorResponse` [shared]

The envelope wrapping every error response.

```typescript
interface ErrorResponse {
  error: ApiError;
}
```

#### Error code reference

| `code`             | `fields` present | HTTP Status |
| ------------------ | ---------------- | ----------- |
| `VALIDATION_ERROR` | Yes              | 400         |
| `NOT_FOUND`        | No               | 404         |
| `INTERNAL_ERROR`   | No               | 500         |

---

## Zod Schema Structure

All validation is defined in `shared/schemas.ts`.

Schemas are the single source of truth for:

- Runtime validation (Express middleware)
- Client-side form validation (`react-hook-form` + `zodResolver`)
- TypeScript type generation via `z.infer<>`

Types in `shared/types.ts` are derived from these schemas rather than written manually.

### AssetTypeSchema

```ts
z.enum(["pipe", "hydrant", "sensor", "valve"]);
```

Produces:

```ts
type AssetType = "pipe" | "hydrant" | "sensor" | "valve";
```

Used by:

- AssetSchema
- CreateAssetSchema
- UpdateAssetSchema
- AssetQuerySchema

---

### AssetStatusSchema

```ts
z.enum(["ok", "warning", "critical"]);
```

Produces:

```ts
type AssetStatus = "ok" | "warning" | "critical";
```

Used by:

- AssetSchema
- CreateAssetSchema
- UpdateAssetSchema
- AssetQuerySchema

---

### IsoDateSchema

Validates dates in API format:

```ts
YYYY - MM - DD;
```

Example:

```ts
z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
```

Used by:

- AssetSchema
- CreateAssetSchema
- UpdateAssetSchema

---

### AssetSchema

Canonical asset shape.

```ts
z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  type: AssetTypeSchema,
  status: AssetStatusSchema,
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  installed_at: IsoDateSchema,
  last_inspected_at: IsoDateSchema.nullable(),
  notes: z.string(),
});
```

Produces:

```ts
type Asset
```

Used for:

- Parsing seed data
- Store validation in tests
- Response validation

---

### CreateAssetSchema

Validation schema for `POST /assets`.

```ts
z.object({
  name: z.string().min(1, "Required."),
  type: AssetTypeSchema,
  status: AssetStatusSchema,
  lat: z.number({ required_error: "Required." }).min(-90).max(90),
  lng: z.number({ required_error: "Required." }).min(-180).max(180),
  installed_at: IsoDateSchema,
  last_inspected_at: IsoDateSchema.nullable().optional().default(null),
  notes: z.string().optional().default(""),
});
```

Produces:

```ts
type CreateAssetInput
```

Used for:

- POST body validation
- AssetForm validation via `zodResolver`

Important behaviors:

- `id` is intentionally absent
- `last_inspected_at` defaults to `null`
- `notes` defaults to `""`

---

### UpdateAssetSchema

Validation schema for `PATCH /assets/:id`.

```ts
z.object({
  name: z.string().min(1).optional(),
  type: AssetTypeSchema.optional(),
  status: AssetStatusSchema.optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  installed_at: IsoDateSchema.optional(),
  last_inspected_at: IsoDateSchema.nullable().optional(),
  notes: z.string().optional(),
});
```

Produces:

```ts
type UpdateAssetInput
```

Key distinction from CreateAssetSchema:

- Every field is optional
- Empty body `{}` is valid
- No defaults are applied
- `last_inspected_at: null` clears the field
- Omitted fields remain unchanged

---

### BBoxSchema

Parses and validates:

```text
minLng,minLat,maxLng,maxLat
```

into:

```ts
interface BBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}
```

Validation rules:

- Exactly four values
- Latitude range: -90 to 90
- Longitude range: -180 to 180
- `minLat <= maxLat`
- `minLng > maxLng` is valid (antimeridian crossing)

Produces:

```ts
type BBox
```

---

### AssetQuerySchema

Validation schema for `GET /assets`.

```ts
z.object({
  type: z
    .union([AssetTypeSchema, z.array(AssetTypeSchema)])
    .optional()
    .transform((v) => (v === undefined ? undefined : [v].flat())),

  status: z
    .union([AssetStatusSchema, z.array(AssetStatusSchema)])
    .optional()
    .transform((v) => (v === undefined ? undefined : [v].flat())),

  bbox: BBoxSchema.optional(),

  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(500).default(25),
});
```

Produces:

```ts
interface AssetQuery {
  type?: AssetType[];
  status?: AssetStatus[];
  bbox?: BBox;
  page: number;
  limit: number;
}
```

Notes:

- Handles both:
  - `?type=pipe`
  - `?type=pipe&type=valve`

- Always outputs arrays for `type` and `status`
- Converts query-string values into numbers
- Applies default values for page and limit
- Matches the filtering and pagination contract exactly

---

### Response Schemas

```ts
PaginationMetaSchema;
AssetListResponseSchema;
SingleAssetResponseSchema;
ErrorResponseSchema;
```

Produce:

```ts
PaginationMeta;
AssetListResponse;
SingleAssetResponse;
ErrorResponse;
```

These schemas ensure that:

```json
{ "data": [...] }
```

```json
{ "data": {...} }
```

```json
{ "error": {...} }
```

always conform to the API contract.

## Type Derivation Map

This shows the relationship between schemas and the types derived from them.

```
shared/schemas.ts                          shared/types.ts
─────────────────────────────────────────────────────────────────────────

AssetTypeSchema           ──infer──►  AssetType
AssetStatusSchema         ──infer──►  AssetStatus
AssetSchema               ──infer──►  Asset
CreateAssetSchema         ──infer──►  CreateAssetInput
UpdateAssetSchema         ──infer──►  UpdateAssetInput
BBoxSchema (output)       ──infer──►  BBox
AssetQuerySchema          ──infer──►  AssetQuery
PaginationMetaSchema      ──infer──►  PaginationMeta
AssetListResponseSchema   ──infer──►  AssetListResponse
SingleAssetResponseSchema ──infer──►  SingleAssetResponse
ErrorResponseSchema       ──infer──►  ErrorResponse
```

Types NOT derived from schemas (written directly, used only in `api/`):

```
api/src/store/asset-store.ts
  AssetFilters       — internal store filter contract
  AssetPage          — store.findAll() return type
  AssetStore         — store interface
```

---

## Layer-by-Layer Data Flow

```
Client submits form
      │
      │  CreateAssetInput (validated by CreateAssetSchema via zodResolver)
      ▼
POST /assets  (body: CreateAssetInput, Content-Type: application/json)
      │
      │  Express parses JSON → validate(CreateAssetSchema) middleware
      │  req.validated: CreateAssetInput
      ▼
AssetController.createAsset(req, res)
      │
      │  reads req.validated as CreateAssetInput
      ▼
MemoryStore.create(input: CreateAssetInput)
      │
      │  generates id = crypto.randomUUID()
      │  stores full Asset in Map<string, Asset>
      │  returns Asset
      ▼
AssetController formats response
      │
      │  { data: Asset } as SingleAssetResponse
      │  res.status(201).header('Location', '/assets/' + id).json(...)
      ▼
Client receives SingleAssetResponse
      │
      │  TanStack Query parses with SingleAssetResponseSchema
      │  queryClient.invalidateQueries(['assets']) → list refetches
      │  queryClient.invalidateQueries(['mapAssets']) → map refetches
      ▼
AssetListResponse rendered in AssetList + AssetMap
```

---

## Nullable vs. Optional — Reference

These two concepts are distinct and easily confused in this codebase.

| Term         | TypeScript syntax        | Meaning                                    |
| ------------ | ------------------------ | ------------------------------------------ |
| **Nullable** | `string \| null`         | The field is present but its value is null |
| **Optional** | `field?: string`         | The field may be entirely absent           |
| **Both**     | `field?: string \| null` | Field may be absent OR present-and-null    |

In this application:

| Field               | In `Asset` (response)    | In `CreateAssetInput`                              | In `UpdateAssetInput`         |
| ------------------- | ------------------------ | -------------------------------------------------- | ----------------------------- |
| `last_inspected_at` | `string \| null`         | `string \| null \| undefined` (optional with null) | `string \| null \| undefined` |
| `notes`             | `string`                 | `string \| undefined` (optional)                   | `string \| undefined`         |
| All other fields    | `T` (required, non-null) | `T` (required) or `T \| undefined` (optional)      | `T \| undefined`              |

The `Asset` type (domain model, response shape) has no optional fields — every field is
always present in a response. Optionality only appears in input types.
