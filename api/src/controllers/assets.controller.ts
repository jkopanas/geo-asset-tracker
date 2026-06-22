import type { RequestHandler } from 'express';
import type { AssetQuery, CreateAssetInput, UpdateAssetInput } from '@shared/types.js';
import type { AssetStore, AssetFilters } from '../store/asset-store.js';
import { NotFoundError } from '../errors/app-errors.js';

export function createAssetsController(store: AssetStore) {
  const listAssets: RequestHandler = async (req, res, next) => {
    try {
      const query = req.validated as AssetQuery;
      const filters: AssetFilters = {
        types: query.type,
        statuses: query.status,
        bbox: query.bbox,
        page: query.page,
        limit: query.limit,
      };
      const { assets, total } = await store.findAll(filters);
      res.status(200).json({
        data: assets,
        meta: {
          total,
          page: query.page,
          limit: query.limit,
          pages: Math.ceil(total / query.limit) || 0,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  const getAsset: RequestHandler = async (req, res, next) => {
    try {
      const asset = await store.findById(req.params.id);
      if (asset === null) throw new NotFoundError(req.params.id);
      res.status(200).json({ data: asset });
    } catch (err) {
      next(err);
    }
  };

  const createAsset: RequestHandler = async (req, res, next) => {
    try {
      const input = req.validated as CreateAssetInput;
      const asset = await store.create(input);
      res.status(201).location(`/assets/${asset.id}`).json({ data: asset });
    } catch (err) {
      next(err);
    }
  };

  const updateAsset: RequestHandler = async (req, res, next) => {
    try {
      const patch = req.validated as UpdateAssetInput;
      const asset = await store.update(req.params.id, patch);
      if (asset === null) throw new NotFoundError(req.params.id);
      res.status(200).json({ data: asset });
    } catch (err) {
      next(err);
    }
  };

  const deleteAsset: RequestHandler = async (req, res, next) => {
    try {
      const deleted = await store.delete(req.params.id);
      if (!deleted) throw new NotFoundError(req.params.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  };

  return { listAssets, getAsset, createAsset, updateAsset, deleteAsset };
}
