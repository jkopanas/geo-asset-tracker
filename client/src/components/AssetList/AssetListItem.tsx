import type { Asset } from '@shared/types.js';
import { STATUS_COLORS } from '../../lib/constants.js';

interface AssetListItemProps {
  asset: Asset;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export function AssetListItem({ asset, isSelected, onSelect }: AssetListItemProps) {
  return (
    <li
      onClick={() => onSelect(asset.id)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: '8px 12px',
        cursor: 'pointer',
        listStyle: 'none',
        backgroundColor: isSelected ? '#e0f2fe' : undefined,
        borderBottom: '1px solid #e5e7eb',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            display: 'inline-block',
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: STATUS_COLORS[asset.status],
            flexShrink: 0,
          }}
        />
        <strong>{asset.name}</strong>
      </div>
      <div style={{ fontSize: 12, color: '#6b7280', paddingLeft: 18 }}>
        {asset.type} · {asset.status}
      </div>
    </li>
  );
}
