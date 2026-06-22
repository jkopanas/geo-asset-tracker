import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UpdateAssetInput } from '@shared/types.js';
import { createAsset, updateAsset, deleteAsset } from '../lib/api.js';

type UpdateVariables = { id: string } & UpdateAssetInput;

export function useAssetMutations() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: createAsset,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
      void queryClient.invalidateQueries({ queryKey: ['mapAssets'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...patch }: UpdateVariables) => updateAsset(id, patch),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
      void queryClient.invalidateQueries({ queryKey: ['mapAssets'] });
      void queryClient.invalidateQueries({ queryKey: ['asset', variables.id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAsset,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
      void queryClient.invalidateQueries({ queryKey: ['mapAssets'] });
    },
  });

  return { createMutation, updateMutation, deleteMutation };
}
