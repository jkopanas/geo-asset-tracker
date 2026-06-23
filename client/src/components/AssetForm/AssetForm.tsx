import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import type { Asset, AssetType, AssetStatus } from '@shared/types.js';
import { CreateAssetSchema } from '@shared/schemas.js';
import { useAssetMutations } from '../../hooks/useAssetMutations.js';
import { LocationPicker } from './LocationPicker.js';

type FormValues = z.infer<typeof CreateAssetSchema>;

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

const inputCls =
  'w-full bg-surface border border-edge rounded px-3 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:border-accent transition-colors';
const labelCls =
  'block text-[10px] font-semibold uppercase tracking-wider text-muted mb-1.5';
const errorCls = 'text-xs text-critical mt-1';

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
  const lat = watch('lat');
  const lng = watch('lng');

  return (
    <div className="w-full max-w-lg bg-panel border border-edge rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
      {/* Header */}
      <div className="flex items-center px-6 py-4 border-b border-edge shrink-0">
        <div
          className="w-2 h-2 rounded-full bg-accent mr-3 shrink-0"
          style={{ boxShadow: '0 0 6px #00b4d8' }}
        />
        <h2 className="text-sm font-semibold text-ink">
          {asset ? 'Edit Asset' : 'New Asset'}
        </h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Name */}
          <div>
            <label className={labelCls}>Name</label>
            <input type="text" className={inputCls} {...register('name')} />
            {errors.name && <p className={errorCls}>{errors.name.message}</p>}
          </div>

          {/* Type + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Type</label>
              <select className={inputCls} {...register('type')}>
                <option value="pipe">Pipe</option>
                <option value="hydrant">Hydrant</option>
                <option value="sensor">Sensor</option>
                <option value="valve">Valve</option>
              </select>
              {errors.type && <p className={errorCls}>{errors.type.message}</p>}
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select className={inputCls} {...register('status')}>
                <option value="ok">Ok</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
              {errors.status && <p className={errorCls}>{errors.status.message}</p>}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Installed</label>
              <input type="date" className={inputCls} {...register('installed_at')} />
              {errors.installed_at && (
                <p className={errorCls}>{errors.installed_at.message}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Last Inspected</label>
              {/*
                Controller so onChange can coerce "" → null.
                HTML date inputs return "" when cleared; IsoDateSchema requires
                /^\d{4}-\d{2}-\d{2}$/ and rejects empty strings.
              */}
              <Controller
                name="last_inspected_at"
                control={control}
                render={({ field }) => (
                  <div className="flex gap-2">
                    <input
                      type="date"
                      className={inputCls}
                      value={field.value ?? ''}
                      onChange={(e) =>
                        field.onChange(e.target.value === '' ? null : e.target.value)
                      }
                    />
                    <button
                      type="button"
                      onClick={() => field.onChange(null)}
                      className="px-2 text-xs text-muted border border-edge rounded hover:text-ink hover:border-dim transition-colors shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                )}
              />
              {errors.last_inspected_at && (
                <p className={errorCls}>{errors.last_inspected_at.message}</p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes</label>
            <textarea className={`${inputCls} resize-none h-16`} {...register('notes')} />
          </div>

          {/* Location */}
          <div>
            <label className={labelCls}>Location</label>
            {(errors.lat || errors.lng) && (
              <p className={errorCls}>{errors.lat?.message ?? errors.lng?.message}</p>
            )}
            <div className="mt-1.5 rounded-lg overflow-hidden border border-edge">
              <LocationPicker
                lat={lat}
                lng={lng}
                onLocationChange={(la, ln) => {
                  setValue('lat', la, { shouldValidate: true });
                  setValue('lng', ln, { shouldValidate: true });
                }}
              />
            </div>
            {lat !== undefined && (
              <p className="text-[10px] font-mono text-muted mt-1">
                {lat.toFixed(6)}, {lng?.toFixed(6)}
              </p>
            )}
          </div>
        </div>

        {(createMutation.isError || updateMutation.isError) && (
          <p className="mx-6 mb-2 px-3 py-2 text-xs text-critical bg-critical/10 border border-critical/30 rounded">
            Failed to save. Please try again.
          </p>
        )}

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-edge shrink-0">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 py-2 text-sm font-semibold text-dim bg-surface hover:bg-surface-hover border border-edge rounded transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 py-2 text-sm font-semibold text-canvas bg-accent hover:brightness-90 rounded transition-all disabled:opacity-50"
          >
            {isPending ? 'Saving…' : asset ? 'Save Changes' : 'Create Asset'}
          </button>
        </div>
      </form>
    </div>
  );
}
