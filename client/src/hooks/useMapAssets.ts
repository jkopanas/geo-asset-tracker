import { useQuery } from '@tanstack/react-query';
import type {
  AssetType,
  AssetStatus,
  BBox,
  AssetListResponse,
} from '@shared/types.js';
import { getAssets } from '../lib/api.js';

type Filters = { type: AssetType[]; status: AssetStatus[] };

export function useMapAssets(filters: Filters, bbox: BBox | undefined) {
  return useQuery<AssetListResponse>({
    queryKey: ['mapAssets', filters, bbox],
    queryFn: () => getAssets({ ...filters, bbox, page: 1, limit: 500 }),
  });
}
