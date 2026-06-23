import { useState, useEffect } from 'react';
import type { AssetType, AssetStatus, BBox, Asset } from '@shared/types.js';
import { FilterBar } from './components/FilterBar/FilterBar.js';
import AssetMap from './components/AssetMap/AssetMap.js';
import { AssetList } from './components/AssetList/AssetList.js';
import { AssetDetail } from './components/AssetDetail/AssetDetail.js';
import { AssetForm } from './components/AssetForm/AssetForm.js';
import { useMapAssets } from './hooks/useMapAssets.js';

type Filters = { type: AssetType[]; status: AssetStatus[] };

function App() {
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({ type: [], status: [] });
  const [bbox, setBbox] = useState<BBox | undefined>();
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | undefined>();
  const [mapResetKey, setMapResetKey] = useState(0);

  const handleReset = () => {
    setSelectedAssetId(null);
    setBbox(undefined);
    setPage(1);
    setMapResetKey((k) => k + 1);
  };

  const handleFiltersChange = (next: Filters) => {
    setFilters(next);
    setPage(1);
  };

  const handleBboxChange = (next: BBox) => {
    setBbox(next);
    setPage(1);
  };

  const { data: mapData } = useMapAssets(filters, bbox);

  useEffect(() => {
    if (!selectedAssetId || !mapData) return;
    const index = mapData.data.findIndex((a) => a.id === selectedAssetId);
    if (index === -1) return;
    setPage(Math.ceil((index + 1) / 25));
  }, [selectedAssetId, mapData]);

  return (
    <div className="h-screen flex flex-col bg-canvas blueprint-grid overflow-hidden">
      {/* Topbar */}
      <header className="h-14 bg-panel border-b border-edge flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="w-2.5 h-2.5 rounded-full bg-accent shrink-0"
            style={{ boxShadow: '0 0 8px #00b4d8, 0 0 16px #00b4d840' }}
          />
          <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-ink">
            Geo Asset Tracker
          </span>
        </div>
        <button
          onClick={() => {
            setEditingAsset(undefined);
            setShowForm(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold bg-accent text-canvas rounded transition-all hover:brightness-90 active:scale-95"
        >
          + New Asset
        </button>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar: filters + list */}
        <aside className="w-72 flex flex-col bg-panel border-r border-edge overflow-hidden shrink-0">
          <FilterBar filters={filters} onChange={handleFiltersChange} />
          <AssetList
            filters={filters}
            bbox={bbox}
            page={page}
            selectedAssetId={selectedAssetId}
            onSelectAsset={setSelectedAssetId}
            onPageChange={setPage}
            onReset={handleReset}
          />
        </aside>

        {/* Map area with detail overlay */}
        <div className="flex-1 relative min-w-0">
          <AssetMap
            filters={filters}
            bbox={bbox}
            selectedAssetId={selectedAssetId}
            onBboxChange={handleBboxChange}
            onSelectAsset={setSelectedAssetId}
            resetKey={mapResetKey}
          />
          {selectedAssetId && (
            <div className="absolute top-4 right-4 w-72 max-h-[calc(100%-2rem)] z-[900] rounded-xl border border-edge shadow-2xl overflow-hidden flex flex-col bg-panel">
              <AssetDetail
                assetId={selectedAssetId}
                filters={filters}
                bbox={bbox}
                onEdit={(asset) => {
                  setEditingAsset(asset);
                  setShowForm(true);
                }}
                onClose={() => setSelectedAssetId(null)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <AssetForm
            asset={editingAsset}
            onSuccess={() => {
              setShowForm(false);
              setEditingAsset(undefined);
            }}
            onCancel={() => {
              setShowForm(false);
              setEditingAsset(undefined);
            }}
          />
        </div>
      )}
    </div>
  );
}

export default App;
