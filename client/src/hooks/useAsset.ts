import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AssetType,
  AssetStatus,
  BBox,
  Asset,
  AssetListResponse,
} from '@shared/types.js';
import { getAsset } from '../lib/api.js';

type Filters = { type: AssetType[]; status: AssetStatus[] };

export function useAsset(
  id: string | null,
  filters: Filters,
  bbox: BBox | undefined
) {
  const queryClient = useQueryClient();

  return useQuery<Asset>({
    queryKey: ['asset', id],
    queryFn: () => getAsset(id!).then((res) => res.data),
    enabled: !!id,
    initialData: () =>
      queryClient
        .getQueryData<AssetListResponse>(['mapAssets', filters, bbox])
        ?.data.find((a) => a.id === id),
  });
}
