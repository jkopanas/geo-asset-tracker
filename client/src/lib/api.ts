import type {
  AssetListResponse,
  SingleAssetResponse,
  ErrorResponse,
  CreateAssetInput,
  UpdateAssetInput,
  AssetQuery,
} from '@shared/types.js';

const BASE_URL = 'http://localhost:3000';

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = (await response.json()) as ErrorResponse;
    throw body.error;
  }
  if (response.status === 204) {
    return undefined as unknown as T;
  }
  return response.json() as Promise<T>;
}

export function getAssets(params: AssetQuery): Promise<AssetListResponse> {
  const qs = new URLSearchParams();
  if (params.type && params.type.length > 0) {
    for (const t of params.type) qs.append('type', t);
  }
  if (params.status && params.status.length > 0) {
    for (const s of params.status) qs.append('status', s);
  }
  if (params.bbox) {
    const { minLng, minLat, maxLng, maxLat } = params.bbox;
    qs.set('bbox', `${minLng},${minLat},${maxLng},${maxLat}`);
  }
  qs.set('page', String(params.page));
  qs.set('limit', String(params.limit));
  return apiFetch<AssetListResponse>(`${BASE_URL}/assets?${qs}`);
}

export function getAsset(id: string): Promise<SingleAssetResponse> {
  return apiFetch<SingleAssetResponse>(`${BASE_URL}/assets/${id}`);
}

export function createAsset(
  body: CreateAssetInput
): Promise<SingleAssetResponse> {
  return apiFetch<SingleAssetResponse>(`${BASE_URL}/assets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function updateAsset(
  id: string,
  body: UpdateAssetInput
): Promise<SingleAssetResponse> {
  return apiFetch<SingleAssetResponse>(`${BASE_URL}/assets/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function deleteAsset(id: string): Promise<void> {
  return apiFetch<void>(`${BASE_URL}/assets/${id}`, { method: 'DELETE' });
}
