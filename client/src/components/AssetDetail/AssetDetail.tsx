import type { AssetType, AssetStatus, BBox, Asset } from '@shared/types.js';
import { useAsset } from '../../hooks/useAsset.js';
import { useAssetMutations } from '../../hooks/useAssetMutations.js';

type Filters = { type: AssetType[]; status: AssetStatus[] };

interface AssetDetailProps {
  assetId: string | null;
  filters: Filters;
  bbox: BBox | undefined;
  onEdit: (asset: Asset) => void;
  onClose: () => void;
}

export function AssetDetail({
  assetId,
  filters,
  bbox,
  onEdit,
  onClose,
}: AssetDetailProps) {
  const { data: asset, isLoading } = useAsset(assetId, filters, bbox);
  const { deleteMutation } = useAssetMutations();

  if (assetId === null) {
    return null;
  }

  if (isLoading || !asset) {
    return <div>Loading…</div>;
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h2 style={{ margin: 0 }}>{asset.name}</h2>
        <button onClick={onClose}>✕</button>
      </div>

      <dl>
        <dt>Type</dt>
        <dd>{asset.type}</dd>

        <dt>Status</dt>
        <dd>{asset.status}</dd>

        <dt>Latitude</dt>
        <dd>{asset.lat}</dd>

        <dt>Longitude</dt>
        <dd>{asset.lng}</dd>

        <dt>Installed</dt>
        <dd>{asset.installed_at}</dd>

        <dt>Last inspected</dt>
        <dd>{asset.last_inspected_at ?? '—'}</dd>

        {asset.notes !== '' && (
          <>
            <dt>Notes</dt>
            <dd>{asset.notes}</dd>
          </>
        )}
      </dl>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onEdit(asset)}>Edit</button>
        <button
          disabled={deleteMutation.isPending}
          onClick={() =>
            deleteMutation.mutate(assetId, {
              onSuccess: () => onClose(),
            })
          }
        >
          {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  );
}
