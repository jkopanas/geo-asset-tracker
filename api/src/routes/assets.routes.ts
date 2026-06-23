import { Router } from 'express';
import type { AssetStore } from '../store/asset-store.js';
import { validate } from '../middleware/validate.js';
import { createAssetsController } from '../controllers/assets.controller.js';
import {
  AssetQuerySchema,
  CreateAssetSchema,
  UpdateAssetSchema,
} from '@shared/schemas.js';

export function assetRouter(store: AssetStore): Router {
  const router = Router();
  const controller = createAssetsController(store);

  router.get('/', validate(AssetQuerySchema, 'query'), controller.listAssets);
  router.get('/:id', controller.getAsset);
  router.post('/', validate(CreateAssetSchema), controller.createAsset);
  router.patch('/:id', validate(UpdateAssetSchema), controller.updateAsset);
  router.delete('/:id', controller.deleteAsset);

  return router;
}
