// src/components/dashboard/agent-card.tsx

'use client';

import Link from 'next/link';
import {
  ShoppingCart,
  Heart,
  Headphones,
  Megaphone,
  Package,
  Power,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toggleAgent } from '@/app/dashboard/agents/actions';
import type { AgentType, AgentStats } from '@/types/agent';

interface AgentCardProps {
  type: AgentType;
  enabled: boolean;
  stats: AgentStats | null;
  storeId: string;
}

const AGENT_META: Record<
  AgentType,
  { label: string; description: string; icon: React.ElementType; color: string }
> = {
  conversion: {
    label: 'Conversion',
    description: 'Personnalise les pages, optimise les offres, A/B teste en continu.',
    icon: ShoppingCart,
    color: 'text-blue-500',
  },
  retention: {
    label: 'Retention',
    description: 'Maximise la LTV. Emails, winback, cross-sell intelligent.',
    icon: Heart,
    color: 'text-pink-500',
  },
  support: {
    label: 'Support',
    description: 'Résout 85% des tickets en <2 minutes. Escalade le reste.',
    icon: Headphones,
    color: 'text-green-500',
  },
  acquisition: {
    label: 'Acquisition',
    description: 'Optimise les ads sur le profit réel, pas le ROAS court terme.',
    icon: Megaphone,
    color: 'text-amber-500',
  },
  operations: {
    label: 'Operations',
    description: 'Prévision de stock, cash flow, supply chain automatisée.',
    icon: Package,
    color: 'text-purple-500',
  },
};

export function AgentCard({ type, enabled, stats, storeId }: AgentCardProps) {
  const meta = AGENT_META[type];
  const Icon = meta.icon;

  return (
    <div
      className={cn(
        'bg-zinc-900 border rounded-xl p-5 transition-all',
        enabled ? 'border-zinc-700' : 'border-zinc-800 opacity-60'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              enabled ? 'bg-zinc-800' : 'bg-zinc-900'
            )}
          >
            <Icon className={cn('h-5 w-5', meta.color)} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-200">{meta.label}</h3>
            <p className="text-xs text-zinc-500 mt-0.5">{meta.description}</p>
          </div>
        </div>

        <form action={toggleAgent}>
          <input type="hidden" name="storeId" value={storeId} />
          <input type="hidden" name="agentType" value={type} />
          <input type="hidden" name="enabled" value={(!enabled).toString()} />
          <button
            type="submit"
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              enabled
                ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
            )}
          >
            <Power className="h-4 w-4" />
          </button>
        </form>
      </div>

      {stats && enabled && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          <AgentStat label="Runs" value={stats.totalRuns.toString()} />
          <AgentStat label="Actions" value={stats.totalActions.toString()} />
          <AgentStat
            label="Success"
            value={`${stats.successRate.toFixed(0)}%`}
          />
        </div>
      )}

      {enabled && (
        <div className="mt-4">
          <Link
            href={`/dashboard/agents/${type}`}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            View details →
          </Link>
        </div>
      )}
    </div>
  );
}

function AgentStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-lg font-bold text-zinc-200">{value}</p>
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</p>
    </div>
  );
            }
