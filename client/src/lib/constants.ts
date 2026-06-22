import type { AssetStatus } from '@shared/types.js';

export const STATUS_COLORS: Record<AssetStatus, string> = {
  ok: '#22c55e',
  warning: '#f59e0b',
  critical: '#ef4444',
};
