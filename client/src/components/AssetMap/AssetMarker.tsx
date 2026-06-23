import { CircleMarker } from 'react-leaflet';
import type { Asset } from '@shared/types.js';
import { STATUS_COLORS } from '../../lib/constants.js';

interface AssetMarkerProps {
  asset: Asset;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export default function AssetMarker({
  asset,
  isSelected,
  onSelect,
}: AssetMarkerProps) {
  return (
    <CircleMarker
      center={[asset.lat, asset.lng]}
      radius={isSelected ? 12 : 8}
      fillColor={STATUS_COLORS[asset.status]}
      color={STATUS_COLORS[asset.status]}
      fillOpacity={isSelected ? 1 : 0.7}
      eventHandlers={{ click: () => onSelect(asset.id) }}
    />
  );
}
