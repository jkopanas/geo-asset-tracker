# CLAUDE.md — Geo Asset Tracker

## Authoritative documents

All implementation must conform to these three documents. Read them before writing any code.

| Document | Governs |
|---|---|
| [architecture.md](./architecture.md) | Project structure, libraries, patterns, decisions |
| [api-contracts.md](./api-contracts.md) | Every endpoint, status code, request/response shape |
| [data-model.md](./data-model.md) | All types, schemas, interfaces, validation rules |
| [implementation-plan.md](./implementation-plan.md) | Task order, inputs, outputs, acceptance criteria |

## Hard rules

**Never invent architecture.** If a pattern, abstraction, or file is not described in the documents above, do not introduce it. When in doubt, ask.

**Never change API contracts.** Status codes, response envelopes, field names, error codes, and pagination shape are fixed. Do not alter them to simplify implementation.

**Never introduce unlisted libraries.** The full dependency list is in `implementation-plan.md` (T03 and T04). Do not add packages not listed there. If you believe one is necessary, stop and ask.

**Never write the service layer.** Controllers call the store directly. The service layer is added when the first real business rule appears — it does not exist today.

**Never use `__dirname`.** This project uses ESM (`"type": "module"`). Use `new URL('...', import.meta.url)` for file paths.

**Always include `.js` extensions on local imports** in `api/` (Node16 ESM resolution requires them).

## Type safety

- TypeScript types are inferred from Zod schemas via `z.infer<>` — never written by hand in `shared/types.ts`
- `req.validated` is the only source of parsed request data in controllers — never read raw `req.body` or `req.query` after the validate middleware has run
- The `key in patch` check (not `patch[key] !== undefined`) is required for PATCH merge semantics — `null` is a valid value and must not be treated as absent
- `page` and `limit` on `AssetQuery` are `number`, not `number | undefined` — `.default()` guarantees their presence

## Testing

- Write tests only for `api/tests/assets.test.ts` — there are exactly 8 tests as specified in `architecture.md`
- Use `beforeEach(() => store.seed(seedData))` — every test must start from a clean slate
- Test 3 (antimeridian) requires inserting a synthetic asset inside the test via `store.create()`, not via `beforeEach`
- Do not add tests beyond the 8 specified without being asked

## Commit discipline

- One logical change per commit
- Commit message describes the why, not the what
- Never `git add .` — stage files explicitly by name
- Never commit `node_modules/`, `.env`, or build artifacts (`dist/`)

## When to ask before proceeding

Ask (do not proceed) if:

- A required behavior is not described in any of the four documents above
- An implementation detail has two plausible interpretations
- A dependency not listed in the plan seems necessary
- A document appears to contain a contradiction
- A task's acceptance criteria cannot be met without changing something the documents define

## Node.js version

Always use Node.js ≥ 20 via NVM:

```bash
export PATH="$HOME/.nvm/versions/node/v20.19.0/bin:$PATH"
```

The system Node (`/usr/bin/node`) is v12 and will fail on ESM and `crypto.randomUUID()`.

## Key implementation traps

These are real failure modes — not hypothetical:

| Trap | Correct approach |
|---|---|
| Leaflet CSS not imported | `import 'leaflet/dist/leaflet.css'` in `client/src/main.tsx` |
| `@shared` alias missing from Vite | Must appear in `client/vite.config.ts` resolve.alias AND `client/tsconfig.json` paths |
| `useMap()` called in `MapContainer` | Must be called inside a child component of `MapContainer` |
| `z.preprocess` for query array coerce | Use `z.union([Schema, z.array(Schema)]).transform(v => [v].flat())` instead |
| `CreateAssetSchema.partial()` for UpdateAssetSchema | Write UpdateAssetSchema as a separate `z.object({})` — partial() inherits defaults |
| `app.listen()` in `app.ts` | Only in `server.ts` — `app.ts` must export with no side effects for Supertest |
| `store.seed()` not exported from `app.ts` | Tests need to import `store` from `app.ts` to call `beforeEach` |
| `minLng > maxLng` treated as invalid bbox | Valid — it signals antimeridian crossing; only `minLat > maxLat` is an error |
