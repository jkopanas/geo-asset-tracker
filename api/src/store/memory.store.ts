import { randomUUID } from 'crypto';
import type { Asset, CreateAssetInput, UpdateAssetInput } from '@shared/types.js';
import type { AssetStore, AssetFilters, AssetPage } from './asset-store.js';

export class MemoryStore implements AssetStore {
  private readonly map = new Map<string, Asset>();

  async findAll(filters: AssetFilters): Promise<AssetPage> {
    let assets = Array.from(this.map.values());

    if (filters.types !== undefined) {
      assets = assets.filter(a => filters.types!.includes(a.type));
    }

    if (filters.statuses !== undefined) {
      assets = assets.filter(a => filters.statuses!.includes(a.status));
    }

    if (filters.bbox !== undefined) {
      const { minLng, minLat, maxLng, maxLat } = filters.bbox;
      assets = assets.filter(a => {
        const latOk = a.lat >= minLat && a.lat <= maxLat;
        const lngOk =
          minLng <= maxLng
            ? a.lng >= minLng && a.lng <= maxLng
            : a.lng >= minLng || a.lng <= maxLng;
        return latOk && lngOk;
      });
    }

    const total = assets.length;
    const { page, limit } = filters;
    const sliced = assets.slice((page - 1) * limit, page * limit);

    return { assets: sliced, total };
  }

  async findById(id: string): Promise<Asset | null> {
    return this.map.get(id) ?? null;
  }

  async create(input: CreateAssetInput): Promise<Asset> {
    const asset: Asset = {
      id: randomUUID(),
      name: input.name,
      type: input.type,
      status: input.status,
      lat: input.lat,
      lng: input.lng,
      installed_at: input.installed_at,
      last_inspected_at: input.last_inspected_at ?? null,
      notes: input.notes ?? '',
    };
    this.map.set(asset.id, asset);
    return asset;
  }

  async update(id: string, patch: UpdateAssetInput): Promise<Asset | null> {
    const existing = this.map.get(id);
    if (existing === undefined) return null;

    const updated: Asset = { ...existing };
    for (const key of Object.keys(patch) as (keyof UpdateAssetInput)[]) {
      if (key in patch) {
        (updated as Record<string, unknown>)[key] = patch[key];
      }
    }
    this.map.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    if (!this.map.has(id)) return false;
    this.map.delete(id);
    return true;
  }

  async seed(assets: Asset[]): Promise<void> {
    this.map.clear();
    for (const asset of assets) {
      this.map.set(asset.id, asset);
    }
  }
}
