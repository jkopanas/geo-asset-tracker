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
      className={`flex flex-col gap-0.5 px-4 py-3 cursor-pointer border-b border-edge border-l-2 transition-colors ${
        isSelected ? 'bg-surface' : 'hover:bg-surface-hover'
      }`}
      style={{ borderLeftColor: STATUS_COLORS[asset.status] }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-ink truncate">{asset.name}</span>
        <span
          className="text-[10px] font-mono shrink-0 px-1.5 py-0.5 rounded"
          style={{
            color: STATUS_COLORS[asset.status],
            backgroundColor: STATUS_COLORS[asset.status] + '26',
          }}
        >
          {asset.status}
        </span>
      </div>
      <span className="text-[11px] font-mono text-muted">{asset.type}</span>
    </li>
  );
}
