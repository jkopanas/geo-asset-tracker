# Geo Asset Tracker — API Contract

This document is the authoritative specification for the asset tracking HTTP API.
It defines every endpoint, request shape, response shape, validation rule, and error format.
Both the server implementation and the frontend client are built against this contract.

---

## Base URL

```
http://localhost:3000
```

All paths are relative to this base. No `/api` prefix. No version prefix.

## Content Type

All requests with a body must send `Content-Type: application/json`.
All responses are `Content-Type: application/json`.

---

## Data Model

### Asset

The canonical asset shape returned by all endpoints.

```json
{
  "id": "17fc695a-07a0-4a6e-8822-e8f36c031199",
  "name": "Sensor S-0001",
  "type": "sensor",
  "status": "ok",
  "lat": 42.373366,
  "lng": -71.133174,
  "installed_at": "2001-04-05",
  "last_inspected_at": "2025-09-21",
  "notes": ""
}
```

### Field reference

| Field               | Type             | Nullable | Notes                                   |
| ------------------- | ---------------- | -------- | --------------------------------------- |
| `id`                | string (UUID v4) | No       | Server-generated. Never sent by client. |
| `name`              | string           | No       | Non-empty.                              |
| `type`              | enum             | No       | `pipe` `hydrant` `sensor` `valve`       |
| `status`            | enum             | No       | `ok` `warning` `critical`               |
| `lat`               | number           | No       | Decimal degrees. Range: -90 to 90.      |
| `lng`               | number           | No       | Decimal degrees. Range: -180 to 180.    |
| `installed_at`      | string (date)    | No       | ISO 8601 date: `YYYY-MM-DD`.            |
| `last_inspected_at` | string (date)    | Yes      | ISO 8601 date or `null`.                |
| `notes`             | string           | No       | May be empty string `""`.               |

---

## Response Envelope

Every successful response wraps the payload in a `data` field.
List responses additionally include a `meta` field.

### Single resource

```json
{
  "data": { ...asset }
}
```

### List response

```json
{
  "data": [ ...assets ],
  "meta": {
    "total":  80,
    "page":   1,
    "limit":  25,
    "pages":  4
  }
}
```

| Meta field | Description                                                |
| ---------- | ---------------------------------------------------------- |
| `total`    | Total assets matching the current filters (pre-pagination) |
| `page`     | Current page number (1-indexed)                            |
| `limit`    | Page size used for this response                           |
| `pages`    | Total pages: `ceil(total / limit)`                         |

---

## Error Response

All errors — validation failures, not-found, server errors — use the same envelope.

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "No asset with id 'abc-123' exists."
  }
}
```

Validation errors add a `fields` object with per-field messages.

```json
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

### Error codes

| Code               | HTTP Status | When                                                             |
| ------------------ | ----------- | ---------------------------------------------------------------- |
| `VALIDATION_ERROR` | 400         | Missing required field, wrong type, invalid enum, malformed bbox |
| `NOT_FOUND`        | 404         | Asset id does not exist                                          |
| `INTERNAL_ERROR`   | 500         | Unexpected server error (no stack trace in body)                 |

---

## HTTP Status Codes

| Code | Meaning      | Used for                                     |
| ---- | ------------ | -------------------------------------------- |
| 200  | OK           | Successful GET, PATCH                        |
| 201  | Created      | Successful POST (includes `Location` header) |
| 204  | No Content   | Successful DELETE (no response body)         |
| 400  | Bad Request  | Validation failure on body or query params   |
| 404  | Not Found    | Asset does not exist                         |
| 500  | Server Error | Unexpected failure                           |

---

## Endpoints

---

### `GET /assets`

List assets. Supports filtering by type, status, and geographic bounding box.
Results are paginated. Both the map query (high limit, no page) and the list
query (low limit, paginated) use this single endpoint with different parameters.

#### Query parameters

| Parameter | Type          | Required | Default | Constraints       | Description                                      |
| --------- | ------------- | -------- | ------- | ----------------- | ------------------------------------------------ |
| `type`    | string (enum) | No       | —       | Repeatable        | Filter by asset type. Multiple values are OR-ed. |
| `status`  | string (enum) | No       | —       | Repeatable        | Filter by status. Multiple values are OR-ed.     |
| `bbox`    | string        | No       | —       | Exactly 4 numbers | Bounding box filter. See bounding box section.   |
| `page`    | integer       | No       | `1`     | ≥ 1               | Page number (1-indexed).                         |
| `limit`   | integer       | No       | `25`    | 1–500             | Results per page. Use `500` for map queries.     |

#### Filter semantics

```
?type=pipe                        → assets where type = pipe
?type=pipe&type=valve             → assets where type = pipe OR type = valve
?status=warning                   → assets where status = warning
?status=warning&status=critical   → assets where status = warning OR status = critical
?type=pipe&status=warning         → assets where type = pipe AND status = warning
?type=pipe&type=valve&status=critical
                                  → assets where (type = pipe OR type = valve)
                                                 AND status = critical
?bbox=-74.02,40.70,-73.93,40.78   → assets within bounding box
?bbox=...&type=sensor             → sensors within bounding box
```

No filters returns all assets.
Filters of different types combine with AND.
Multiple values of the same filter combine with OR.

#### Example requests

```
GET /assets
GET /assets?page=2&limit=25
GET /assets?status=warning&status=critical
GET /assets?type=pipe&bbox=-74.02,40.70,-73.93,40.78&page=1&limit=25
GET /assets?status=warning&bbox=-74.02,40.70,-73.93,40.78&limit=500
```

#### Success response — `200 OK`

```json
{
  "data": [
    {
      "id": "17fc695a-07a0-4a6e-8822-e8f36c031199",
      "name": "Sensor S-0001",
      "type": "sensor",
      "status": "ok",
      "lat": 42.373366,
      "lng": -71.133174,
      "installed_at": "2001-04-05",
      "last_inspected_at": "2025-09-21",
      "notes": ""
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 25,
    "pages": 6
  }
}
```

If no assets match the filters, `data` is an empty array and `meta.total` is `0`.

```json
{
  "data": [],
  "meta": {
    "total": 0,
    "page": 1,
    "limit": 25,
    "pages": 0
  }
}
```

If `page` exceeds `meta.pages`, `data` is an empty array and `meta` reflects the actual
totals.

#### Error responses

| Condition                          | Code | Body                                    |
| ---------------------------------- | ---- | --------------------------------------- |
| `type` is not a valid enum value   | 400  | `VALIDATION_ERROR` with `fields.type`   |
| `status` is not a valid enum value | 400  | `VALIDATION_ERROR` with `fields.status` |
| `bbox` has wrong number of values  | 400  | `VALIDATION_ERROR` with `fields.bbox`   |
| `bbox` contains non-numeric values | 400  | `VALIDATION_ERROR` with `fields.bbox`   |
| `bbox` lat/lng out of range        | 400  | `VALIDATION_ERROR` with `fields.bbox`   |
| `page` < 1 or not an integer       | 400  | `VALIDATION_ERROR` with `fields.page`   |
| `limit` < 1 or > 500               | 400  | `VALIDATION_ERROR` with `fields.limit`  |

---

### `GET /assets/:id`

Fetch a single asset by its UUID.

#### Path parameters

| Parameter | Type          | Description |
| --------- | ------------- | ----------- |
| `id`      | string (UUID) | Asset UUID  |

#### Success response — `200 OK`

```json
{
  "data": {
    "id": "17fc695a-07a0-4a6e-8822-e8f36c031199",
    "name": "Sensor S-0001",
    "type": "sensor",
    "status": "ok",
    "lat": 42.373366,
    "lng": -71.133174,
    "installed_at": "2001-04-05",
    "last_inspected_at": "2025-09-21",
    "notes": ""
  }
}
```

#### Error responses

| Condition              | Code | Body        |
| ---------------------- | ---- | ----------- |
| No asset with given id | 404  | `NOT_FOUND` |

---

### `POST /assets`

Create a new asset. The server generates the `id`. The client must not send `id`.

#### Request body

```json
{
  "name": "Valve V-0010",
  "type": "valve",
  "status": "ok",
  "lat": 40.712776,
  "lng": -74.005974,
  "installed_at": "2025-06-22",
  "last_inspected_at": null,
  "notes": "Installed during Q2 maintenance."
}
```

#### Request body fields

| Field               | Required | Type          | Constraints                                            |
| ------------------- | -------- | ------------- | ------------------------------------------------------ |
| `name`              | Yes      | string        | Non-empty                                              |
| `type`              | Yes      | enum          | `pipe` `hydrant` `sensor` `valve`                      |
| `status`            | Yes      | enum          | `ok` `warning` `critical`                              |
| `lat`               | Yes      | number        | -90 to 90                                              |
| `lng`               | Yes      | number        | -180 to 180                                            |
| `installed_at`      | Yes      | string (date) | ISO 8601: `YYYY-MM-DD`                                 |
| `last_inspected_at` | No       | string / null | ISO 8601 date or `null`. Defaults to `null` if absent. |
| `notes`             | No       | string        | Defaults to `""` if absent.                            |

Extra fields in the body are ignored.
The `id` field is ignored if sent — the server always generates a new UUID.

#### Success response — `201 Created`

Includes a `Location` header pointing to the new resource.

```
Location: /assets/3fa85f64-5717-4562-b3fc-2c963f66afa6
```

```json
{
  "data": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "Valve V-0010",
    "type": "valve",
    "status": "ok",
    "lat": 40.712776,
    "lng": -74.005974,
    "installed_at": "2025-06-22",
    "last_inspected_at": null,
    "notes": "Installed during Q2 maintenance."
  }
}
```

#### Error responses

| Condition                                       | Code | Body                                               |
| ----------------------------------------------- | ---- | -------------------------------------------------- |
| `name` is missing or empty                      | 400  | `VALIDATION_ERROR` with `fields.name`              |
| `type` is missing or invalid                    | 400  | `VALIDATION_ERROR` with `fields.type`              |
| `status` is missing or invalid                  | 400  | `VALIDATION_ERROR` with `fields.status`            |
| `lat` is missing                                | 400  | `VALIDATION_ERROR` with `fields.lat`               |
| `lat` is not a number                           | 400  | `VALIDATION_ERROR` with `fields.lat`               |
| `lat` out of range                              | 400  | `VALIDATION_ERROR` with `fields.lat`               |
| `lng` is missing                                | 400  | `VALIDATION_ERROR` with `fields.lng`               |
| `lng` is not a number                           | 400  | `VALIDATION_ERROR` with `fields.lng`               |
| `lng` out of range                              | 400  | `VALIDATION_ERROR` with `fields.lng`               |
| `installed_at` is missing                       | 400  | `VALIDATION_ERROR` with `fields.installed_at`      |
| `installed_at` is not a valid date              | 400  | `VALIDATION_ERROR` with `fields.installed_at`      |
| `last_inspected_at` is not a valid date or null | 400  | `VALIDATION_ERROR` with `fields.last_inspected_at` |
| Multiple failures                               | 400  | `VALIDATION_ERROR` with all failing `fields`       |

---

### `PATCH /assets/:id`

Partially update an asset. Only fields present in the body are updated.
Fields absent from the body are left unchanged.
An empty body `{}` is valid — the asset is returned unchanged.

#### Path parameters

| Parameter | Type          | Description |
| --------- | ------------- | ----------- |
| `id`      | string (UUID) | Asset UUID  |

#### Request body

All fields are optional. Send only the fields you want to change.

```json
{
  "status": "warning",
  "notes": "Pressure reading elevated. Scheduled for inspection."
}
```

#### Request body fields

| Field               | Required | Type          | Constraints                         |
| ------------------- | -------- | ------------- | ----------------------------------- |
| `name`              | No       | string        | Non-empty if present                |
| `type`              | No       | enum          | `pipe` `hydrant` `sensor` `valve`   |
| `status`            | No       | enum          | `ok` `warning` `critical`           |
| `lat`               | No       | number        | -90 to 90                           |
| `lng`               | No       | number        | -180 to 180                         |
| `installed_at`      | No       | string (date) | ISO 8601: `YYYY-MM-DD`              |
| `last_inspected_at` | No       | string / null | ISO 8601 date or `null` to clear it |
| `notes`             | No       | string        | Empty string `""` is valid          |

**Null semantics for `last_inspected_at`:**

- Field absent from body → existing value unchanged
- Field present as `null` → field is set to `null` (cleared)
- Field present as a date string → field is updated to that date

Extra fields in the body are ignored.

#### Success response — `200 OK`

Returns the full updated asset.

```json
{
  "data": {
    "id": "17fc695a-07a0-4a6e-8822-e8f36c031199",
    "name": "Sensor S-0001",
    "type": "sensor",
    "status": "warning",
    "lat": 42.373366,
    "lng": -71.133174,
    "installed_at": "2001-04-05",
    "last_inspected_at": "2025-09-21",
    "notes": "Pressure reading elevated. Scheduled for inspection."
  }
}
```

#### Error responses

| Condition                                                   | Code | Body                                               |
| ----------------------------------------------------------- | ---- | -------------------------------------------------- |
| No asset with given id                                      | 404  | `NOT_FOUND`                                        |
| `name` is present but empty                                 | 400  | `VALIDATION_ERROR` with `fields.name`              |
| `type` is present but invalid                               | 400  | `VALIDATION_ERROR` with `fields.type`              |
| `status` is present but invalid                             | 400  | `VALIDATION_ERROR` with `fields.status`            |
| `lat` is present but out of range                           | 400  | `VALIDATION_ERROR` with `fields.lat`               |
| `lng` is present but out of range                           | 400  | `VALIDATION_ERROR` with `fields.lng`               |
| `installed_at` is present but not a valid date              | 400  | `VALIDATION_ERROR` with `fields.installed_at`      |
| `last_inspected_at` is present but not a valid date or null | 400  | `VALIDATION_ERROR` with `fields.last_inspected_at` |

---

### `DELETE /assets/:id`

Delete an asset permanently. The operation is not reversible within the session.

#### Path parameters

| Parameter | Type          | Description |
| --------- | ------------- | ----------- |
| `id`      | string (UUID) | Asset UUID  |

#### Success response — `204 No Content`

No response body.

#### Error responses

| Condition              | Code | Body        |
| ---------------------- | ---- | ----------- |
| No asset with given id | 404  | `NOT_FOUND` |

---

## Validation Rules

Complete reference for all field-level validation applied on `POST` and `PATCH`.

### `name`

- Type: `string`
- Required on `POST`. Optional on `PATCH`.
- Must not be empty string if present.
- No maximum length enforced by the API.

### `type`

- Type: `string` (enum)
- Required on `POST`. Optional on `PATCH`.
- Accepted values: `pipe`, `hydrant`, `sensor`, `valve`
- Any other value → `VALIDATION_ERROR` with `fields.type: "Must be one of: pipe, hydrant, sensor, valve"`

### `status`

- Type: `string` (enum)
- Required on `POST`. Optional on `PATCH`.
- Accepted values: `ok`, `warning`, `critical`
- Any other value → `VALIDATION_ERROR` with `fields.status: "Must be one of: ok, warning, critical"`

### `lat`

- Type: `number`
- Required on `POST`. Optional on `PATCH`.
- Range: `-90` to `90` inclusive.
- String `"42.5"` is rejected — must be a JSON number.
- `null` is rejected.
- Out-of-range value (`lat: 999`) → `VALIDATION_ERROR` with `fields.lat`

### `lng`

- Type: `number`
- Required on `POST`. Optional on `PATCH`.
- Range: `-180` to `180` inclusive.
- String is rejected — must be a JSON number.
- `null` is rejected.

### `installed_at`

- Type: `string`
- Required on `POST`. Optional on `PATCH`.
- Format: ISO 8601 date — `YYYY-MM-DD` (e.g., `"2025-06-22"`)
- Invalid format → `VALIDATION_ERROR` with `fields.installed_at`

### `last_inspected_at`

- Type: `string | null`
- Optional on both `POST` and `PATCH`.
- On `POST`: if absent, defaults to `null`.
- On `PATCH`: if absent, field is not changed. If present as `null`, field is cleared. If present as a date string, field is updated.
- Format when not null: ISO 8601 date — `YYYY-MM-DD`

### `notes`

- Type: `string`
- Optional on both `POST` and `PATCH`.
- On `POST`: if absent, defaults to `""`.
- Empty string `""` is a valid value.
- `null` is rejected.

### Query parameter validation (`GET /assets`)

| Parameter | Validation                                                      |
| --------- | --------------------------------------------------------------- |
| `type`    | Each value must be in `[pipe, hydrant, sensor, valve]`          |
| `status`  | Each value must be in `[ok, warning, critical]`                 |
| `bbox`    | Exactly 4 comma-separated numbers. See bounding box section.    |
| `page`    | Must be an integer ≥ 1. Non-integer or `0` → 400.               |
| `limit`   | Must be an integer between 1 and 500. Defaults to 25 if absent. |

---

## Pagination Strategy

### Mechanism

Offset-based pagination controlled by `page` and `limit` query parameters.

```
page=1, limit=25  → returns records 0–24
page=2, limit=25  → returns records 25–49
page=N, limit=L   → returns records (N-1)*L to (N*L)-1
```

### Response meta

Every `GET /assets` response includes pagination metadata regardless of whether
a `page` parameter was sent.

```json
"meta": {
  "total":  80,
  "page":   2,
  "limit":  25,
  "pages":  4
}
```

`meta.total` is the count of assets matching the current filters **before** pagination is
applied. This is the correct number to show in UI elements like "Showing 25 of 80."

### Page beyond range

If `page` is greater than `meta.pages`, the response is:

```json
{
  "data": [],
  "meta": {
    "total": 80,
    "page": 99,
    "limit": 25,
    "pages": 4
  }
}
```

This is not an error — `data` is simply empty.

### Map vs. list usage

The same endpoint serves both the paginated list and the map marker query.
The only difference is the `limit` parameter:

```
List query (AssetList component):
GET /assets?status=warning&bbox=...&page=1&limit=25

Map query (AssetMap component):
GET /assets?status=warning&bbox=...&limit=500
```

The map query does not send a `page` parameter (defaults to `1`).
Using `limit=500` ensures all matching markers are returned for the current viewport.
If more than 500 assets match, only the first 500 are returned — the user must zoom in.

---

## Filtering Strategy

### How filters compose

Multiple values of the **same** parameter are combined with **OR**.
Different parameters are combined with **AND**.

```
Truth table:

?type=pipe                          type = pipe
?type=pipe&type=valve               type = pipe OR type = valve
?status=warning                     status = warning
?status=warning&status=critical     status = warning OR status = critical
?type=pipe&status=warning           type = pipe AND status = warning

?type=pipe&type=valve&status=warning
  → (type = pipe OR type = valve) AND (status = warning)
  → warning pipes and warning valves

?type=sensor&status=warning&status=critical
  → type = sensor AND (status = warning OR status = critical)
  → sensors that are warning or critical
```

### Bbox interaction

`bbox` is an additional AND condition applied after type and status filters.

```
?type=sensor&bbox=...
  → sensors inside the bbox

?type=sensor&status=critical&bbox=...
  → critical sensors inside the bbox
```

### Filter order (server-side)

Filters are applied in this order inside the store:

```
1. type filter
2. status filter
3. bbox filter
4. count total (for meta.total)
5. paginate (slice for page + limit)
```

`meta.total` always reflects the count after all filters, before pagination.

---

## Bounding Box Strategy

### Parameter format

```
?bbox=minLng,minLat,maxLng,maxLat
```

Four comma-separated decimal degree values in WGS84 (EPSG:4326).

| Position | Field    | Range       | Example  |
| -------- | -------- | ----------- | -------- |
| 1        | `minLng` | -180 to 180 | `-74.02` |
| 2        | `minLat` | -90 to 90   | `40.70`  |
| 3        | `maxLng` | -180 to 180 | `-73.93` |
| 4        | `maxLat` | -90 to 90   | `40.78`  |

Example:

```
?bbox=-74.02,40.70,-73.93,40.78
```

### Inclusion logic

An asset is inside the bounding box if **both** conditions hold:

**Latitude (same in both cases):**

```
asset.lat >= minLat  AND  asset.lat <= maxLat
```

**Longitude — two cases:**

```
Case A — Normal box (minLng <= maxLng):

  e.g., bbox=-74.02,40.70,-73.93,40.78
  asset.lng >= minLng  AND  asset.lng <= maxLng

Case B — Antimeridian-crossing box (minLng > maxLng):

  e.g., bbox=170.0,35.0,-170.0,50.0
  asset.lng >= minLng  OR   asset.lng <= maxLng
```

**Detection:** if `minLng > maxLng`, the box crosses the antimeridian (±180° longitude).

### Antimeridian explanation

```
Normal box (-74 to -73):
  ───────────────────────────────────
  -180                        0                        +180
               [=====]
               -74  -73
  Assets between -74 and -73: AND condition

Antimeridian box (170 to -170):
  ───────────────────────────────────
  -180                        0                        +180
  [====]                                            [====]
  -180 -170                                        170  180
  Assets west of -170 OR east of 170: OR condition
```

### Coordinate normalization (client responsibility)

Leaflet's `map.getBounds()` may return longitude values outside [-180, 180] when the user
pans across the antimeridian (e.g., `getEast()` returns `190` instead of `-170`).

The client must normalize before sending to the API:

```
normalized = ((lng + 180) % 360) - 180
```

The API only accepts coordinates within [-180, 180] for each value.
Sending `190` as a longitude value returns a `400 VALIDATION_ERROR`.

### Bbox validation

| Condition                                   | Response                                                                                           |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Fewer than 4 comma-separated values         | `400 VALIDATION_ERROR` with `fields.bbox: "Must be exactly 4 values: minLng,minLat,maxLng,maxLat"` |
| More than 4 comma-separated values          | `400 VALIDATION_ERROR` same message                                                                |
| Non-numeric value in any position           | `400 VALIDATION_ERROR` with `fields.bbox`                                                          |
| `minLat` < -90 or `maxLat` > 90             | `400 VALIDATION_ERROR` with `fields.bbox`                                                          |
| Any longitude outside [-180, 180]           | `400 VALIDATION_ERROR` with `fields.bbox`                                                          |
| `minLat` > `maxLat`                         | `400 VALIDATION_ERROR` with `fields.bbox: "minLat must not exceed maxLat"`                         |
| `minLng > maxLng`                           | **Valid** — interpreted as antimeridian-crossing box                                               |
| `minLng === maxLng` and `minLat === maxLat` | Valid — zero-area box (single point); returns assets exactly at that coordinate                    |

---

## Example Scenarios

### Get all assets, first page

```
GET /assets?page=1&limit=25

200 OK
{
  "data": [ ...25 assets ],
  "meta": { "total": 150, "page": 1, "limit": 25, "pages": 6 }
}
```

### Get all warning and critical sensors in a viewport (map query)

```
GET /assets?type=sensor&status=warning&status=critical&bbox=-74.02,40.70,-73.93,40.78&limit=500

200 OK
{
  "data": [ ...all matching sensors ],
  "meta": { "total": 12, "page": 1, "limit": 500, "pages": 1 }
}
```

### Create an asset

```
POST /assets
Content-Type: application/json

{
  "name": "Hydrant H-0099",
  "type": "hydrant",
  "status": "ok",
  "lat": 40.748817,
  "lng": -73.985428,
  "installed_at": "2025-06-22",
  "last_inspected_at": null,
  "notes": ""
}

201 Created
Location: /assets/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d

{
  "data": {
    "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "name": "Hydrant H-0099",
    "type": "hydrant",
    "status": "ok",
    "lat": 40.748817,
    "lng": -73.985428,
    "installed_at": "2025-06-22",
    "last_inspected_at": null,
    "notes": ""
  }
}
```

### Update only the status

```
PATCH /assets/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d
Content-Type: application/json

{
  "status": "critical"
}

200 OK
{
  "data": {
    "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "name": "Hydrant H-0099",
    "type": "hydrant",
    "status": "critical",
    "lat": 40.748817,
    "lng": -73.985428,
    "installed_at": "2025-06-22",
    "last_inspected_at": null,
    "notes": ""
  }
}
```

### Clear `last_inspected_at`

```
PATCH /assets/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d
Content-Type: application/json

{
  "last_inspected_at": null
}

200 OK  (last_inspected_at is now null)
```

### Validation failure — missing required fields

```
POST /assets
Content-Type: application/json

{
  "name": "Broken Asset"
}

400 Bad Request
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request body is invalid.",
    "fields": {
      "type":         "Required.",
      "status":       "Required.",
      "lat":          "Required.",
      "lng":          "Required.",
      "installed_at": "Required."
    }
  }
}
```

### Asset not found

```
GET /assets/00000000-0000-0000-0000-000000000000

404 Not Found
{
  "error": {
    "code":    "NOT_FOUND",
    "message": "No asset with id '00000000-0000-0000-0000-000000000000' exists."
  }
}
```

### Malformed bounding box

```
GET /assets?bbox=-74.02,40.70,-73.93

400 Bad Request
{
  "error": {
    "code":    "VALIDATION_ERROR",
    "message": "Request query is invalid.",
    "fields": {
      "bbox": "Must be exactly 4 values: minLng,minLat,maxLng,maxLat."
    }
  }
}
```

### Delete an asset

```
DELETE /assets/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d

204 No Content
(no body)
```
