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
  onReset: () => void;
}

export function AssetList({
  filters,
  bbox,
  page,
  selectedAssetId,
  onSelectAsset,
  onPageChange,
  onReset,
}: AssetListProps) {
  const { data, isLoading, isError } = useAssets(filters, bbox, page);
  const { data: unfilteredData } = useAssets(filters, undefined, 1);

  const countLabel = (() => {
    if (!data) return null;
    const filtered = data.meta.total;
    const full = unfilteredData?.meta.total ?? filtered;
    if (!bbox) return `${filtered} total assets`;
    if (filtered === 0) return '0 total assets';
    return `${filtered} out of ${full} assets`;
  })();

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Section header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-edge shrink-0">
        <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-muted">
          Assets
        </span>
        <div className="flex items-center gap-3">
          {countLabel && (
            <span className="text-[10px] font-mono text-muted">{countLabel}</span>
          )}
          {selectedAssetId && (
            <button
              onClick={onReset}
              className="text-[10px] font-semibold text-accent hover:brightness-90 transition-colors"
            >
              Reset Assets
            </button>
          )}
        </div>
      </div>

      {/* List body */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center h-16 text-xs text-muted">
            Loading…
          </div>
        )}
        {isError && !isLoading && (
          <div className="flex items-center justify-center h-16 text-xs text-critical px-4 text-center">
            Could not load assets.
          </div>
        )}
        {data && (
          <ul>
            {data.data.map((asset) => (
              <AssetListItem
                key={asset.id}
                asset={asset}
                isSelected={asset.id === selectedAssetId}
                onSelect={onSelectAsset}
              />
            ))}
            {data.data.length === 0 && (
              <li className="flex items-center justify-center h-16 text-xs text-muted">
                No assets in this view
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Pagination */}
      {data && data.meta.pages > 1 && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-edge shrink-0">
          <button
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="text-xs text-dim hover:text-ink disabled:text-muted disabled:cursor-not-allowed transition-colors"
          >
            ← Prev
          </button>
          <span className="text-[10px] font-mono text-muted">
            {page} / {data.meta.pages}
          </span>
          <button
            disabled={page >= data.meta.pages}
            onClick={() => onPageChange(page + 1)}
            className="text-xs text-dim hover:text-ink disabled:text-muted disabled:cursor-not-allowed transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
