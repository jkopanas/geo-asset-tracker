import type { AssetType, AssetStatus, BBox } from '@shared/types.js';
import { useAssets } from '../../hooks/useAssets.js';
import { AssetListItem } from './AssetListItem.js';

type Filters = { type: AssetType[]; status: AssetStatus[] };

interface AssetListProps {
  filters: Filters;
  bbox: BBox | undefined;
  page: number;
  selectedAssetId: string | null;
  onSelectAsset: (id: string) => void;
  onPageChange: (page: number) => void;
}

export function AssetList({
  filters,
  bbox,
  page,
  selectedAssetId,
  onSelectAsset,
  onPageChange,
}: AssetListProps) {
  const { data, isLoading, isError } = useAssets(filters, bbox, page);

  if (isLoading) {
    return <div>Loading…</div>;
  }

  if (isError || !data) {
    return <div>Could not load assets. Try again.</div>;
  }

  const { data: assets, meta } = data;

  return (
    <div>
      <ul style={{ margin: 0, padding: 0 }}>
        {assets.map((asset) => (
          <AssetListItem
            key={asset.id}
            asset={asset}
            isSelected={asset.id === selectedAssetId}
            onSelect={onSelectAsset}
          />
        ))}
      </ul>
      {meta.pages > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
          }}
        >
          <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            Prev
          </button>
          <span>
            {page} / {meta.pages}
          </span>
          <button
            disabled={page >= meta.pages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
