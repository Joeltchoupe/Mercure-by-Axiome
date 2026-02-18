// src/components/dashboard/billing/billing-history.tsx

import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';
import type { Subscription } from '@/types/billing';

interface BillingHistoryProps {
  subscriptions: Subscription[];
}

export function BillingHistory({ subscriptions }: BillingHistoryProps) {
  if (subscriptions.length === 0) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <h2 className="text-sm font-semibold text-zinc-200 mb-4">
        Billing History
      </h2>
      <div className="space-y-3">
        {subscriptions.map((sub) => (
          <div
            key={sub.id}
            className="flex items-center justify-between py-2 border-b border-zinc-800/50 last:border-0"
          >
            <div className="flex items-center gap-3">
              <StatusDot status={sub.status} />
              <div>
                <p className="text-sm text-zinc-300 capitalize">
                  {sub.plan} — ${sub.priceUsd}/mo
                </p>
                <p className="text-xs text-zinc-500">
                  {formatDate(sub.createdAt, 'long')}
                </p>
              </div>
            </div>
            <span
              className={cn(
                'text-[10px] px-2 py-0.5 rounded-full font-medium capitalize',
                sub.status === 'active' && 'bg-emerald-500/10 text-emerald-500',
                sub.status === 'cancelled' && 'bg-zinc-700 text-zinc-400',
                sub.status === 'declined' && 'bg-red-500/10 text-red-500',
                sub.status === 'pending' && 'bg-amber-500/10 text-amber-500',
                sub.status === 'expired' && 'bg-zinc-700 text-zinc-500'
              )}
            >
              {sub.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  return (
    <div
      className={cn(
        'w-2 h-2 rounded-full',
        status === 'active' && 'bg-emerald-500',
        status === 'cancelled' && 'bg-zinc-500',
        status === 'declined' && 'bg-red-500',
        status === 'pending' && 'bg-amber-500',
        status === 'expired' && 'bg-zinc-600'
      )}
    />
  );
}
