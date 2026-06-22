import type { Asset, AssetType, AssetStatus, BBox, CreateAssetInput, UpdateAssetInput } from '@shared/types.js';

export interface AssetFilters {
  types?: AssetType[];
  statuses?: AssetStatus[];
  bbox?: BBox;
  page: number;
  limit: number;
}

export interface AssetPage {
  assets: Asset[];
  total: number;
}

export interface AssetStore {
  findAll(filters: AssetFilters): Promise<AssetPage>;
  findById(id: string): Promise<Asset | null>;
  create(input: CreateAssetInput): Promise<Asset>;
  update(id: string, patch: UpdateAssetInput): Promise<Asset | null>;
  delete(id: string): Promise<boolean>;
  seed(assets: Asset[]): Promise<void>;
}
