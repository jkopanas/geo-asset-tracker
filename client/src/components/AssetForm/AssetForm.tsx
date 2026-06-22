import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import type { Asset, AssetType, AssetStatus } from '@shared/types.js';
import { CreateAssetSchema } from '@shared/schemas.js';
import { useAssetMutations } from '../../hooks/useAssetMutations.js';
import { LocationPicker } from './LocationPicker.js';

type FormValues = z.infer<typeof CreateAssetSchema>;

// lat/lng intentionally absent — undefined until the user picks a location,
// which makes LocationPicker use its own default center instead of [0, 0].
const DEFAULT_VALUES = {
  name: '',
  type: 'pipe' as AssetType,
  status: 'ok' as AssetStatus,
  installed_at: '',
  notes: '',
  last_inspected_at: null as string | null,
};

interface AssetFormProps {
  asset?: Asset;
  onSuccess: () => void;
  onCancel: () => void;
}

export function AssetForm({ asset, onSuccess, onCancel }: AssetFormProps) {
  const { createMutation, updateMutation } = useAssetMutations();

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(CreateAssetSchema),
    defaultValues: asset ?? DEFAULT_VALUES,
  });

  const onSubmit = (data: FormValues) => {
    if (asset) {
      updateMutation.mutate({ id: asset.id, ...data }, { onSuccess });
    } else {
      createMutation.mutate(data, { onSuccess });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <h2 style={{ margin: '0 0 16px' }}>{asset ? 'Edit asset' : 'New asset'}</h2>

      <div>
        <label>Name</label>
        <input type="text" {...register('name')} />
        {errors.name && <span>{errors.name.message}</span>}
      </div>

      <div>
        <label>Type</label>
        <select {...register('type')}>
          <option value="pipe">Pipe</option>
          <option value="hydrant">Hydrant</option>
          <option value="sensor">Sensor</option>
          <option value="valve">Valve</option>
        </select>
        {errors.type && <span>{errors.type.message}</span>}
      </div>

      <div>
        <label>Status</label>
        <select {...register('status')}>
          <option value="ok">Ok</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
        </select>
        {errors.status && <span>{errors.status.message}</span>}
      </div>

      <div>
        <label>Installed</label>
        <input type="date" {...register('installed_at')} />
        {errors.installed_at && <span>{errors.installed_at.message}</span>}
      </div>

      <div>
        <label>Last inspected</label>
        {/*
          last_inspected_at uses a Controller so onChange can coerce "" → null.
          HTML date inputs return "" when cleared; IsoDateSchema requires
          /^\d{4}-\d{2}-\d{2}$/ and rejects empty strings. Without this coercion
          a user clearing the field would get a schema error instead of null.
        */}
        <Controller
          name="last_inspected_at"
          control={control}
          render={({ field }) => (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="date"
                value={field.value ?? ''}
                onChange={(e) =>
                  field.onChange(e.target.value === '' ? null : e.target.value)
                }
              />
              <button type="button" onClick={() => field.onChange(null)}>
                Clear
              </button>
            </div>
          )}
        />
        {errors.last_inspected_at && (
          <span>{errors.last_inspected_at.message}</span>
        )}
      </div>

      <div>
        <label>Notes</label>
        <textarea {...register('notes')} />
        {errors.notes && <span>{errors.notes.message}</span>}
      </div>

      <div>
        <label>Location</label>
        <LocationPicker
          lat={watch('lat')}
          lng={watch('lng')}
          onLocationChange={(lat, lng) => {
            setValue('lat', lat, { shouldValidate: true });
            setValue('lng', lng, { shouldValidate: true });
          }}
        />
        {errors.lat && <span>{errors.lat.message}</span>}
        {errors.lng && <span>{errors.lng.message}</span>}
      </div>

      {(createMutation.isError || updateMutation.isError) && (
        <div>Failed to save. Please try again.</div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button type="button" onClick={onCancel} disabled={isPending}>
          Cancel
        </button>
        <button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : asset ? 'Save changes' : 'Create'}
        </button>
      </div>
    </form>
  );
}
