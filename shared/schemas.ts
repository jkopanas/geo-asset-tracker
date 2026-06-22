import { z } from 'zod';

// ── 1. Primitive enumerations ─────────────────────────────────────────────────

export const AssetTypeSchema = z.enum(['pipe', 'hydrant', 'sensor', 'valve']);

export const AssetStatusSchema = z.enum(['ok', 'warning', 'critical']);

// ── 2. Reusable ISO date string ───────────────────────────────────────────────
//
// Defined once here. AssetSchema, CreateAssetSchema, and UpdateAssetSchema all
// reference this constant — no regex duplication.

export const IsoDateSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  'Must be a valid date in YYYY-MM-DD format',
);

// ── 3. Asset — canonical domain model ────────────────────────────────────────

export const AssetSchema = z.object({
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

// ── 4. Create DTO — POST /assets body ────────────────────────────────────────
//
// Required fields produce explicit 'Required.' messages so that the validate
// middleware's fieldErrors map contains human-readable strings for each field.
// Optional fields carry defaults so the store always receives a complete object.

export const CreateAssetSchema = z.object({
  name: z.string().min(1, 'Required.'),
  type: AssetTypeSchema,
  status: AssetStatusSchema,
  lat: z.number({ required_error: 'Required.' }).min(-90).max(90),
  lng: z.number({ required_error: 'Required.' }).min(-180).max(180),
  installed_at: IsoDateSchema,
  last_inspected_at: IsoDateSchema.nullable().optional().default(null),
  notes: z.string().optional().default(''),
});

// ── 5. Update DTO — PATCH /assets/:id body ───────────────────────────────────
//
// Written as an independent z.object(), NOT CreateAssetSchema.partial().
//
// Why not .partial(): CreateAssetSchema has .default(null) on last_inspected_at
// and .default('') on notes. If .partial() were used, those defaults would
// remain active, meaning an absent PATCH field would be filled with a default
// value instead of being omitted from the output entirely. PATCH semantics
// require: absent = no change; present null = clear; present string = update.
// Only a fresh z.object() with no defaults achieves this correctly.

export const UpdateAssetSchema = z.object({
  name: z.string().min(1).optional(),
  type: AssetTypeSchema.optional(),
  status: AssetStatusSchema.optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  installed_at: IsoDateSchema.optional(),
  last_inspected_at: IsoDateSchema.nullable().optional(),
  notes: z.string().optional(),
});

// ── 6. Bounding box ───────────────────────────────────────────────────────────
//
// Parses the query string "minLng,minLat,maxLng,maxLat" into a typed object.
//
// Antimeridian rule: minLng > maxLng is VALID — it signals that the box crosses
// ±180° longitude. No check is performed on longitude order.
// North/south rule:  minLat > maxLat IS an error — south cannot exceed north.

export const BBoxSchema = z.string().transform((val, ctx) => {
  const parts = val.split(',').map(Number);

  if (parts.length !== 4 || parts.some(isNaN)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Must be exactly 4 values: minLng,minLat,maxLng,maxLat',
    });
    return z.NEVER;
  }

  const [minLng, minLat, maxLng, maxLat] = parts as [number, number, number, number];

  if (minLng < -180 || minLng > 180) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'minLng must be between -180 and 180' });
    return z.NEVER;
  }
  if (maxLng < -180 || maxLng > 180) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'maxLng must be between -180 and 180' });
    return z.NEVER;
  }
  if (minLat < -90 || minLat > 90) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'minLat must be between -90 and 90' });
    return z.NEVER;
  }
  if (maxLat < -90 || maxLat > 90) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'maxLat must be between -90 and 90' });
    return z.NEVER;
  }
  if (minLat > maxLat) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'minLat must not exceed maxLat' });
    return z.NEVER;
  }

  return { minLng, minLat, maxLng, maxLat };
});

// ── 7. Query parameters — GET /assets ────────────────────────────────────────
//
// type and status use union + transform (not z.preprocess).
//
// Why union + transform: Express passes a single ?type=pipe as a string and
// ?type=pipe&type=valve as a string[]. z.preprocess bypasses Zod's type
// inference, making the output type 'unknown' until manually cast. The
// union([single, array]).transform([v].flat()) pattern keeps TypeScript fully
// informed of the output type without any cast.
//
// page and limit: z.coerce + .default() guarantees the output is always
// 'number' (never undefined). Controllers can read query.page directly.

export const AssetQuerySchema = z.object({
  type: z
    .union([AssetTypeSchema, z.array(AssetTypeSchema)])
    .optional()
    .transform((v): z.infer<typeof AssetTypeSchema>[] | undefined =>
      v === undefined ? undefined : [v].flat(),
    ),

  status: z
    .union([AssetStatusSchema, z.array(AssetStatusSchema)])
    .optional()
    .transform((v): z.infer<typeof AssetStatusSchema>[] | undefined =>
      v === undefined ? undefined : [v].flat(),
    ),

  bbox: BBoxSchema.optional(),

  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(500).default(25),
});

// ── 8. Response schemas ───────────────────────────────────────────────────────

export const PaginationMetaSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
  pages: z.number().int().nonnegative(),
});

export const AssetListResponseSchema = z.object({
  data: z.array(AssetSchema),
  meta: PaginationMetaSchema,
});

export const SingleAssetResponseSchema = z.object({
  data: AssetSchema,
});

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  fields: z.record(z.string()).optional(),
});

export const ErrorResponseSchema = z.object({
  error: ApiErrorSchema,
});
