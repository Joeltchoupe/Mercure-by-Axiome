// src/components/dashboard/billing/usage-panel.tsx

import { getPlan } from '@/config/billing.config';
import { cn } from '@/lib/utils';
import type { UsageMetrics, BillingPlan } from '@/types/billing';

interface UsagePanelProps {
  usage: UsageMetrics;
  plan: BillingPlan;
}

export function UsagePanel({ usage, plan }: UsagePanelProps) {
  const planDetails = getPlan(plan);

  const meters = [
    {
      label: 'Events today',
      current: usage.eventsToday,
      max: planDetails.limits.maxEventsPerDay,
      format: 'number' as const,
    },
    {
      label: 'LLM cost this month',
      current: usage.llmCostThisMonth,
      max: planDetails.limits.maxLlmCostPerMonthUsd,
      format: 'currency' as const,
    },
    {
      label: 'Active agents',
      current: usage.activeAgents,
      max: planDetails.limits.maxAgents,
      format: 'number' as const,
    },
    {
      label: 'Memory documents',
      current: usage.vectorDocuments,
      max: planDetails.limits.vectorDocuments,
      format: 'number' as const,
    },
  ];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <h2 className="text-sm font-semibold text-zinc-200 mb-4">
        Usage — {planDetails.name} Plan
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {meters.map((meter) => (
          <UsageMeter key={meter.label} {...meter} />
        ))}
      </div>
    </div>
  );
}

function UsageMeter({
  label,
  current,
  max,
  format,
}: {
  label: string;
  current: number;
  max: number;
  format: 'number' | 'currency';
}) {
  const percentage = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const isNearLimit = percentage >= 80;
  const isOverLimit = percentage >= 100;

  function formatValue(val: number): string {
    if (format === 'currency') return `$${val.toFixed(2)}`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
    return val.toString();
  }

  return (
    <div>
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className="text-lg font-bold text-zinc-200">
        {formatValue(current)}
        <span className="text-xs text-zinc-500 font-normal">
          {' '}
          / {max === -1 ? '∞' : formatValue(max)}
        </span>
      </p>
      <div className="w-full h-1.5 bg-zinc-800 rounded-full mt-2 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            isOverLimit
              ? 'bg-red-500'
              : isNearLimit
                ? 'bg-amber-500'
                : 'bg-emerald-500'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
