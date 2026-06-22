# Asset Tracking Application — Assignment Analysis

This is a developer-perspective breakdown of the take-home assignment. It is a roadmap for
the technical decisions document that follows. No implementation choices are made here —
this is the "what and why" before the "how."

---

## 1. Functional Requirements

### Stated clearly

- **CRUD:** create, edit, delete, list assets
- **Filtering:** filter list by `type` and `status`
- **Geospatial filter:** bounding box or within-radius (candidate chooses one)
- **Map view:** all assets as markers, color-coded by status
- **Marker interaction:** clicking a marker opens a detail view
- **Forms:** create and edit asset, with in-map location picker
- **Seeding:** load ~150 assets from `seed.json` on startup

### Why it matters

The CRUD surface is small by design. The evaluators want to see how you shape the API
around it — resource naming, query string design, response envelope — not just whether the
endpoints exist. The geospatial filter is the one technically interesting problem in the
brief; everything else is table stakes.

---

## 2. Non-Functional Requirements

| Area       | Requirement                                                              |
| ---------- | ------------------------------------------------------------------------ |
| Stack      | Node.js / Express, TypeScript backend; React TypeScript frontend         |
| Storage    | Candidate's choice: Postgres (±PostGIS), MongoDB, or in-memory           |
| Tests      | A "small handful of meaningful ones" — quality over quantity             |
| API design | Explicitly evaluated: endpoints, query shape, response shape, pagination |
| UI         | Usable, not production-polished                                          |
| Delivery   | Public git repo, runs locally                                            |

### Why it matters

Storage choice and test choice are signals about judgment under time pressure. The
assignment gives an explicit escape hatch for both ("in-memory if you'd rather spend the
time elsewhere"). Using it and being able to explain the tradeoff is not a weakness —
refusing to use it and shipping a half-broken Postgres setup is.

---

## 3. Hidden Requirements

These are never stated but are silently evaluated.

**API contract quality.**
"API design is part of what we evaluate" means reviewers will critique endpoint names,
query parameters, HTTP status codes, and error response shape. A `200` with
`{ error: "not found" }` in the body will be noticed.

**Pagination.**
Mentioned in "what we look for" but never mandated. With only 150 assets it is easy to
skip. That is exactly why it is a test — a senior engineer adds it anyway because it is
cheap and demonstrates they think about growth.

**Idempotent seeding.**
The brief says "seed on startup." If the seed runs on every restart with hardcoded UUIDs
and no upsert logic, you get duplicate key errors or doubles on a persistent store. The
brief does not call this out — you have to see it.

**Shared types between frontend and backend.**
TypeScript on both ends implies a shared type definition. Candidates who duplicate the
`Asset` type in two places and let them drift are flagged.

**Git history as a narrative.**
A public repo means reviewers read commits. Squashing everything into one commit, or
committing with messages like "fix" and "wip," is a red flag. The progression of decisions
should be legible.

**CORS.**
Frontend and backend almost certainly run on different ports locally. Forgetting CORS means
the reviewer cannot run the app at all.

**Validation lives somewhere.**
The brief explicitly asks about this. They want to see a clear answer: client-side only is
insufficient; server-side is minimum viable; both is correct.

---

## 4. Edge Cases

### Data shape

- `last_inspected_at` can be `null`. Any query, serializer, or display component that
  assumes it is always a date will break.
- `notes` can be an empty string. The UI should handle this gracefully — do not render an
  empty "Notes" section as if it is meaningful.

### Geospatial

- A bounding box large enough to return all 150 assets should not crash or time out, and
  should not silently return an unbounded result set when pagination is expected.
- A bounding box of zero area (a single point) is technically valid but edge-case behavior
  varies by implementation.
- Coordinates at the antimeridian (±180° longitude) require special handling. Not expected
  here, but the API shape must not structurally prevent it later.
- Invalid coordinates on create/edit (`lat: 999`, `lng: -999`) — server must reject these;
  client should too.

### CRUD

- Delete a non-existent asset: should return `404`, not `500` or `200`.
- Edit with a partial body: the choice between PUT (full replacement) and PATCH (partial
  update) must be consistent and deliberate.
- Create without a location: the map picker makes it easy to omit `lat`/`lng` before
  submitting. Frontend should prevent it; backend must validate regardless.

### Seeding

- In-memory: data resets on restart. Expected and fine.
- Postgres: `INSERT` without `ON CONFLICT DO NOTHING` crashes on restart due to duplicate
  UUIDs. Must be handled.

---

## 5. Reviewer Expectations

**They want to read the API like a specification.**
Consistent resource path (`/assets`), correct HTTP verbs, predictable response envelope
(e.g., `{ data: [...], meta: { total, page, limit } }`), and error responses with a stable
shape (`{ error: { code, message } }`).

**They want the geospatial filter to demonstrate real understanding.**
Fetching all rows and filtering in JavaScript is detectable and is a fail. The filter must
happen at the storage layer — `WHERE` clause arithmetic, PostGIS `ST_Within`, or MongoDB
`$geoWithin`. The choice signals whether the candidate understands where computation
belongs.

**They want the frontend to reflect structural thinking.**
Not a single 500-line component. Components should have clear responsibilities: filter bar,
map layer, marker, detail drawer, form. State management should be proportionate — local
state and one or two fetch hooks, not a global store.

**They want tests that hit the interesting paths.**
Testing that `GET /assets` returns `200` is noise. Testing that the bounding box filter
returns only assets inside the box, that creating an asset with missing `lat` returns
`422`, or that `type` and `status` filters compose correctly — those are signal.

**The map library choice is read as a signal.**
Leaflet: pragmatic, no API key, widely known. MapLibre: respected for modern architecture.
Google Maps: requires an API key and billing — reviewer friction, candidate did not think
about the reviewer experience. ArcGIS: signals domain familiarity but adds unnecessary
complexity.

---

## 6. Common Candidate Mistakes

**Treating pagination as optional.**
The brief specifically lists "pagination" under "what we evaluate." Skipping it without
acknowledgment is a silent miss.

**In-memory storage with no explanation.**
Using in-memory is allowed. The mistake is using it with no documentation and no thought
about seeding behavior on restart. One paragraph in the README explaining the tradeoff
shows judgment. Silence looks like it was not a choice.

**Geospatial filter in application code.**
Loading all rows from the store and calling `.filter()` in JavaScript defeats the stated
purpose of evaluating "a reasonable approach to the geospatial query." Reviewers
specifically look for this.

**No consistent error response shape.**
Express defaults to different formats for thrown errors, validation failures, and 404s. A
candidate who does not normalize this has never built an API that another team consumes.

**Validation only on the frontend.**
Form validation that blocks bad submits is UX. Server validation that rejects bad requests
is correctness. Both are needed. POSTing an empty body directly to the API and getting a
`500` is a failure.

**Duplicate `Asset` type in client and server.**
Almost always leads to silent drift. A shared `types/` directory or even a single
`shared.ts` that both sides import is the minimum. Not doing this with TypeScript on both
ends signals the candidate does not think about the team.

**Forgetting seed idempotency.**
The seed file has fixed UUIDs. On Postgres without `ON CONFLICT DO NOTHING`, a restart
crashes. On MongoDB without an upsert, duplicates accumulate. Many candidates discover this
only when the reviewer reports the app does not restart cleanly.

**Overcrowding the map marker click handler.**
Putting modal open, state mutation, fetch, and display logic all inside `onClick` becomes
unreadable. The click handler should set a selected ID; the detail panel reads from that.

**Tests that only cover happy paths.**
A test for `GET /assets` returning seed data is worth almost nothing. Tests should cover
invariants: the geospatial filter is correct, validation rejects invalid input, a missing
asset returns `404`.

---

## 7. Where Over-Engineering Should Be Avoided

**Storage infrastructure.**
Spending time on Postgres + PostGIS + Docker Compose + migrations is a large investment
that pays off only if the geospatial query is meaningfully better for it. A candidate who
sets all of this up and ships a buggy frontend has made the wrong call. The tradeoff is
worth naming in the README.

**State management.**
Redux Toolkit, Zustand, Jotai — none are needed for 150 assets and four components. React
Query handles server state; `useState` handles local UI state. A global store here signals
reaching for patterns rather than right-sizing.

**Monorepo tooling.**
Turborepo, Nx, Yarn Workspaces solve problems at scale. For one backend and one frontend,
they are friction. Two directories in one repo with two `package.json` files is sufficient.

**Test coverage breadth.**
"A small handful of meaningful ones is more useful than full coverage." Five targeted tests
at the right invariants outperform forty tests of CRUD plumbing.

**API versioning.**
No external client will consume this API. `/api/v1/assets` is not wrong, but `/assets` is
simpler and equally correct. Versioning here signals applying a pattern without considering
whether it is warranted.

**Loading and error state exhaustiveness.**
Handling all three async states for every component is correct production behavior. For a
take-home, a missing spinner on map load is noise. A missing error state when the whole
page fails to load is signal. Pick the spots that matter.

**Authentication stubs.**
`// TODO: add auth here` is clutter. Auth is explicitly out of scope. One sentence in the
README is enough. Commented-out middleware is a negative signal.

---

## Open Questions (to resolve before building)

- **Geospatial filter:** bounding box or radius? _(bounding box maps to map viewport; more
  natural for this UX)_
- **Storage:** in-memory or Postgres? _(in-memory frees time for API and frontend quality)_
- **Map library:** Leaflet, MapLibre, or other? _(Leaflet: no API key, least friction for
  reviewer)_
- **Pagination style:** offset/page or cursor? _(offset is simpler and correct at this
  scale)_
- **PUT or PATCH for edits?** _(PATCH is more correct for partial updates from a form)_
- **Shared types:** single `shared.ts` or npm workspace? _(single file is sufficient here)_
- **Test runner:** Vitest or Jest? _(Vitest: faster, native ESM, consistent with Vite
  frontend)_
