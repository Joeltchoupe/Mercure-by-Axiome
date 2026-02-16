// src/components/dashboard/activity-filters.tsx

'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

interface ActivityFiltersProps {
  currentFilters: {
    eventType?: string;
    agentType?: string;
    status?: string;
  };
}

const EVENT_TYPES = [
  { value: '', label: 'All Events' },
  { value: 'order.created', label: 'Orders' },
  { value: 'checkout.started', label: 'Checkouts' },
  { value: 'cart.updated', label: 'Carts' },
  { value: 'customer.created', label: 'Customers' },
  { value: 'support.ticket.created', label: 'Support' },
];

const AGENT_TYPES = [
  { value: '', label: 'All Agents' },
  { value: 'conversion', label: 'Conversion' },
  { value: 'retention', label: 'Retention' },
  { value: 'support', label: 'Support' },
  { value: 'acquisition', label: 'Acquisition' },
  { value: 'operations', label: 'Operations' },
];

const STATUSES = [
  { value: '', label: 'All Status' },
  { value: 'success', label: 'Success' },
  { value: 'error', label: 'Error' },
  { value: 'skipped', label: 'Skipped' },
];

export function ActivityFilters({ currentFilters }: ActivityFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page'); // Reset pagination on filter change
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-3">
      <FilterSelect
        options={EVENT_TYPES}
        value={currentFilters.eventType ?? ''}
        onChange={(v) => updateFilter('type', v)}
      />
      <FilterSelect
        options={AGENT_TYPES}
        value={currentFilters.agentType ?? ''}
        onChange={(v) => updateFilter('agent', v)}
      />
      <FilterSelect
        options={STATUSES}
        value={currentFilters.status ?? ''}
        onChange={(v) => updateFilter('status', v)}
      />
    </div>
  );
}

function FilterSelect({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2',
        'text-xs text-zinc-300',
        'outline-none focus:border-zinc-600 transition-colors',
        'cursor-pointer'
      )}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
    }
