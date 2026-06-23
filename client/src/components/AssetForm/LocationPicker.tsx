import {
  MapContainer,
  TileLayer,
  CircleMarker,
  useMapEvents,
} from 'react-leaflet';

interface LocationPickerProps {
  lat?: number;
  lng?: number;
  onLocationChange: (lat: number, lng: number) => void;
}

interface MapClickHandlerProps {
  onLocationChange: (lat: number, lng: number) => void;
}

function MapClickHandler({ onLocationChange }: MapClickHandlerProps) {
  useMapEvents({
    click(e) {
      onLocationChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function LocationPicker({
  lat,
  lng,
  onLocationChange,
}: LocationPickerProps) {
  const center: [number, number] =
    lat !== undefined && lng !== undefined ? [lat, lng] : [42.36, -71.06];

  return (
    <MapContainer
      center={center}
      zoom={12}
      style={{ height: 200, width: '100%' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <MapClickHandler onLocationChange={onLocationChange} />
      {lat !== undefined && lng !== undefined && (
        <CircleMarker
          center={[lat, lng]}
          radius={10}
          fillColor="#3b82f6"
          color="#3b82f6"
          fillOpacity={0.9}
        />
      )}
    </MapContainer>
  );
}
