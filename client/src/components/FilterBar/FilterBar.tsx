import type { AssetType, AssetStatus } from '@shared/types.js';
import { STATUS_COLORS } from '../../lib/constants.js';

type Filters = { type: AssetType[]; status: AssetStatus[] };

interface FilterBarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

const TYPES: { value: AssetType; label: string }[] = [
  { value: 'pipe', label: 'Pipe' },
  { value: 'hydrant', label: 'Hydrant' },
  { value: 'sensor', label: 'Sensor' },
  { value: 'valve', label: 'Valve' },
];

const STATUSES: { value: AssetStatus; label: string }[] = [
  { value: 'ok', label: 'Ok' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
];

function Checkmark() {
  return (
    <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none">
      <path
        d="M1.5 5l2.5 2.5 4.5-4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FilterBar({ filters, onChange }: FilterBarProps) {
  const toggleType = (value: AssetType) => {
    const next = filters.type.includes(value)
      ? filters.type.filter((t) => t !== value)
      : [...filters.type, value];
    onChange({ ...filters, type: next });
  };

  const toggleStatus = (value: AssetStatus) => {
    const next = filters.status.includes(value)
      ? filters.status.filter((s) => s !== value)
      : [...filters.status, value];
    onChange({ ...filters, status: next });
  };

  return (
    <div className="p-4 border-b border-edge shrink-0">
      <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-muted mb-3">
        Filters
      </p>

      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-wider text-muted mb-2">Type</p>
        <div className="space-y-2">
          {TYPES.map(({ value, label }) => {
            const checked = filters.type.includes(value);
            return (
              <label key={value} className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={() => toggleType(value)}
                />
                <div
                  className={`w-4 h-4 rounded border transition-colors flex items-center justify-center shrink-0 ${
                    checked
                      ? 'bg-accent border-accent text-canvas'
                      : 'border-edge bg-surface text-transparent group-hover:border-dim'
                  }`}
                >
                  <Checkmark />
                </div>
                <span className="text-xs text-ink">{label}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted mb-2">Status</p>
        <div className="space-y-2">
          {STATUSES.map(({ value, label }) => {
            const checked = filters.status.includes(value);
            return (
              <label key={value} className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={() => toggleStatus(value)}
                />
                <div
                  className="w-4 h-4 rounded border transition-colors flex items-center justify-center shrink-0 text-canvas"
                  style={
                    checked
                      ? { backgroundColor: STATUS_COLORS[value], borderColor: STATUS_COLORS[value] }
                      : { borderColor: '#1e3d5c', backgroundColor: '#162d44' }
                  }
                >
                  {checked && <Checkmark />}
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: STATUS_COLORS[value] }}
                  />
                  <span className="text-xs text-ink">{label}</span>
                </div>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
