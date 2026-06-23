import { useState } from "react";
import type { AssetType, AssetStatus, BBox, Asset } from "@shared/types.js";
import { FilterBar } from "./components/FilterBar/FilterBar.js";
import AssetMap from "./components/AssetMap/AssetMap.js";
import { AssetList } from "./components/AssetList/AssetList.js";
import { AssetDetail } from "./components/AssetDetail/AssetDetail.js";
import { AssetForm } from "./components/AssetForm/AssetForm.js";

type Filters = { type: AssetType[]; status: AssetStatus[] };

function App() {
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({ type: [], status: [] });
  const [bbox, setBbox] = useState<BBox | undefined>();
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | undefined>();

  const handleFiltersChange = (next: Filters) => {
    setFilters(next);
    setPage(1);
  };

  const handleBboxChange = (next: BBox) => {
    setBbox(next);
    setPage(1);
  };

  return (
    <>
      <FilterBar filters={filters} onChange={handleFiltersChange} />

      <button
        onClick={() => {
          setEditingAsset(undefined);
          setShowForm(true);
        }}
      >
        New Asset
      </button>

      <AssetMap
        filters={filters}
        bbox={bbox}
        selectedAssetId={selectedAssetId}
        onBboxChange={handleBboxChange}
        onSelectAsset={setSelectedAssetId}
      />

      <AssetList
        filters={filters}
        bbox={bbox}
        page={page}
        selectedAssetId={selectedAssetId}
        onSelectAsset={setSelectedAssetId}
        onPageChange={setPage}
      />

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

      {showForm && (
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
      )}
    </>
  );
}

export default App;
