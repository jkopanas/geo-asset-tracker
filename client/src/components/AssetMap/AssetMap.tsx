import { useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import type { AssetType, AssetStatus, BBox } from '@shared/types.js';
import { useMapAssets } from '../../hooks/useMapAssets.js';
import AssetMarker from './AssetMarker.js';

const normLng = (lng: number) => (((lng + 180) % 360) + 360) % 360 - 180;

interface MapControllerProps {
  onBboxChange: (bbox: BBox) => void;
}

function MapController({ onBboxChange }: MapControllerProps) {
  const map = useMap();

  useEffect(() => {
    const handleMoveEnd = () => {
      const bounds = map.getBounds();
      onBboxChange({
        minLng: normLng(bounds.getWest()),
        minLat: bounds.getSouth(),
        maxLng: normLng(bounds.getEast()),
        maxLat: bounds.getNorth(),
      });
    };
    map.on('moveend', handleMoveEnd);
    return () => { map.off('moveend', handleMoveEnd); };
  }, [map, onBboxChange]);

  return null;
}

interface AssetMapProps {
  filters: { type: AssetType[]; status: AssetStatus[] };
  bbox: BBox | undefined;
  selectedAssetId: string | null;
  onBboxChange: (bbox: BBox) => void;
  onSelectAsset: (id: string) => void;
}

export default function AssetMap({
  filters,
  bbox,
  selectedAssetId,
  onBboxChange,
  onSelectAsset,
}: AssetMapProps) {
  const { data } = useMapAssets(filters, bbox);

  return (
    <MapContainer
      center={[42.36, -71.06]}
      zoom={12}
      style={{ height: 480, width: '100%' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <MapController onBboxChange={onBboxChange} />
      {data?.data.map(asset => (
        <AssetMarker
          key={asset.id}
          asset={asset}
          isSelected={asset.id === selectedAssetId}
          onSelect={onSelectAsset}
        />
      ))}
    </MapContainer>
  );
}
