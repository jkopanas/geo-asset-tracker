import { useQuery } from '@tanstack/react-query';
import type {
  AssetType,
  AssetStatus,
  BBox,
  AssetListResponse,
} from '@shared/types.js';
import { getAssets } from '../lib/api.js';

type Filters = { type: AssetType[]; status: AssetStatus[] };

export function useAssets(
  filters: Filters,
  bbox: BBox | undefined,
  page: number
) {
  return useQuery<AssetListResponse>({
    queryKey: ['assets', filters, bbox, page],
    queryFn: () => getAssets({ ...filters, bbox, page, limit: 25 }),
  });
}
