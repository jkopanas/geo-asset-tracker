import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import type { Asset, AssetType, AssetStatus, BBox } from '@shared/types.js';
import { useMapAssets } from '../../hooks/useMapAssets.js';
import AssetMarker from './AssetMarker.js';

const normLng = (lng: number) => ((((lng + 180) % 360) + 360) % 360) - 180;

interface MapControllerProps {
  onBboxChange: (bbox: BBox) => void;
  onFlyingChange: (flying: boolean) => void;
  selectedAssetId: string | null;
  selectedAsset: Asset | undefined;
  assets: Asset[];
  resetKey: number;
}

function MapController({ onBboxChange, onFlyingChange, selectedAssetId, selectedAsset, assets, resetKey }: MapControllerProps) {
  const map = useMap();
  const hasFitBounds = useRef(false);
  const lastFlownToId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (assets.length === 0) return;
    hasFitBounds.current = false;
    lastFlownToId.current = undefined;
  }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (hasFitBounds.current || assets.length === 0) return;
    map.fitBounds(
      assets.map((a) => [a.lat, a.lng] as [number, number]),
      { padding: [40, 40] },
    );
    hasFitBounds.current = true;
  }, [map, assets, resetKey]);

  useEffect(() => {
    const handleMoveEnd = () => {
      const bounds = map.getBounds();
      onBboxChange({
        minLng: normLng(bounds.getWest()),
        minLat: bounds.getSouth(),
        maxLng: normLng(bounds.getEast()),
        maxLat: bounds.getNorth(),
      });
      onFlyingChange(false);
    };
    map.on('moveend', handleMoveEnd);
    return () => {
      map.off('moveend', handleMoveEnd);
    };
  }, [map, onBboxChange, onFlyingChange]);

  useEffect(() => {
    if (!selectedAssetId) {
      lastFlownToId.current = undefined;
      return;
    }
    if (selectedAssetId === lastFlownToId.current) return;
    if (!selectedAsset) return;
    lastFlownToId.current = selectedAssetId;
    if (map.getZoom() >= 13 && map.getBounds().contains([selectedAsset.lat, selectedAsset.lng])) return;
    onFlyingChange(true);
    map.flyTo([selectedAsset.lat, selectedAsset.lng], 13);
  }, [map, selectedAsset, selectedAssetId, onFlyingChange]);

  return null;
}

interface AssetMapProps {
  filters: { type: AssetType[]; status: AssetStatus[] };
  bbox: BBox | undefined;
  selectedAssetId: string | null;
  onBboxChange: (bbox: BBox) => void;
  onSelectAsset: (id: string) => void;
  resetKey: number;
}

export default function AssetMap({
  filters,
  bbox,
  selectedAssetId,
  onBboxChange,
  onSelectAsset,
  resetKey,
}: AssetMapProps) {
  const { data } = useMapAssets(filters, bbox);
  const selectedAsset = data?.data.find((a) => a.id === selectedAssetId);
  const [isFlying, setIsFlying] = useState(false);

  return (
    <MapContainer
      center={[38.06, -79.39]}
      zoom={5}
      style={{ height: '100%', width: '100%', position: 'absolute', inset: 0 }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <MapController
        onBboxChange={onBboxChange}
        onFlyingChange={setIsFlying}
        selectedAssetId={selectedAssetId}
        selectedAsset={selectedAsset}
        assets={data?.data ?? []}
        resetKey={resetKey}
      />
      {!isFlying && data?.data.map((asset) => (
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
