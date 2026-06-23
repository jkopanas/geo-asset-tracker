import type { AssetType, AssetStatus, BBox, Asset } from '@shared/types.js';
import { useAsset } from '../../hooks/useAsset.js';
import { useAssetMutations } from '../../hooks/useAssetMutations.js';
import { STATUS_COLORS } from '../../lib/constants.js';

type Filters = { type: AssetType[]; status: AssetStatus[] };

interface AssetDetailProps {
  assetId: string | null;
  filters: Filters;
  bbox: BBox | undefined;
  onEdit: (asset: Asset) => void;
  onClose: () => void;
}

export function AssetDetail({ assetId, filters, bbox, onEdit, onClose }: AssetDetailProps) {
  const { data: asset, isLoading } = useAsset(assetId, filters, bbox);
  const { deleteMutation } = useAssetMutations();

  if (assetId === null) return null;

  if (isLoading || !asset) {
    return (
      <div className="flex items-center justify-center h-24 text-xs text-muted">
        Loading…
      </div>
    );
  }

  const statusColor = STATUS_COLORS[asset.status];

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-edge shrink-0">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink truncate">{asset.name}</h2>
          <span className="text-[11px] font-mono text-muted">{asset.type}</span>
        </div>
        <button
          onClick={onClose}
          className="text-muted hover:text-ink ml-2 shrink-0 transition-colors leading-none"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-edge shrink-0">
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: statusColor, boxShadow: `0 0 6px ${statusColor}80` }}
        />
        <span
          className="text-[11px] font-mono font-semibold tracking-wider"
          style={{ color: statusColor }}
        >
          {asset.status.toUpperCase()}
        </span>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted mb-1">Coordinates</p>
          <p className="font-mono text-xs text-accent">
            {asset.lat.toFixed(6)},&nbsp;{asset.lng.toFixed(6)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted mb-1">Installed</p>
            <p className="font-mono text-xs text-ink">{asset.installed_at}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted mb-1">Inspected</p>
            <p className="font-mono text-xs text-ink">{asset.last_inspected_at ?? '—'}</p>
          </div>
        </div>

        {asset.notes !== '' && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted mb-1">Notes</p>
            <p className="text-xs text-dim leading-relaxed">{asset.notes}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 p-4 border-t border-edge shrink-0">
        <button
          onClick={() => onEdit(asset)}
          className="flex-1 py-1.5 text-xs font-semibold text-ink bg-surface hover:bg-surface-hover border border-edge rounded transition-colors"
        >
          Edit
        </button>
        <button
          disabled={deleteMutation.isPending}
          onClick={() => deleteMutation.mutate(assetId, { onSuccess: onClose })}
          className="flex-1 py-1.5 text-xs font-semibold text-critical border border-critical/30 rounded transition-colors disabled:opacity-50 hover:bg-critical/10"
        >
          {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </>
  );
}
