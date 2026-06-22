import type { z } from 'zod';
import {
  AssetTypeSchema,
  AssetStatusSchema,
  AssetSchema,
  CreateAssetSchema,
  UpdateAssetSchema,
  BBoxSchema,
  AssetQuerySchema,
  PaginationMetaSchema,
  AssetListResponseSchema,
  SingleAssetResponseSchema,
  ApiErrorSchema,
  ErrorResponseSchema,
} from './schemas.js';

export type AssetType = z.infer<typeof AssetTypeSchema>;
export type AssetStatus = z.infer<typeof AssetStatusSchema>;
export type Asset = z.infer<typeof AssetSchema>;
export type CreateAssetInput = z.infer<typeof CreateAssetSchema>;
export type UpdateAssetInput = z.infer<typeof UpdateAssetSchema>;
export type BBox = z.infer<typeof BBoxSchema>;
export type AssetQuery = z.infer<typeof AssetQuerySchema>;
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;
export type AssetListResponse = z.infer<typeof AssetListResponseSchema>;
export type SingleAssetResponse = z.infer<typeof SingleAssetResponseSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
