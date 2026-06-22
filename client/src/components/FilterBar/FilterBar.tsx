import type { AssetType, AssetStatus } from '@shared/types.js';

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
    <div>
      <fieldset>
        <legend>Type</legend>
        {TYPES.map(({ value, label }) => (
          <label key={value}>
            <input
              type="checkbox"
              checked={filters.type.includes(value)}
              onChange={() => toggleType(value)}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Status</legend>
        {STATUSES.map(({ value, label }) => (
          <label key={value}>
            <input
              type="checkbox"
              checked={filters.status.includes(value)}
              onChange={() => toggleStatus(value)}
            />
            {label}
          </label>
        ))}
      </fieldset>
    </div>
  );
}
