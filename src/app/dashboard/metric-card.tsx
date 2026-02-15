// src/components/dashboard/metric-card.tsx

import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: number;
  previousValue: number;
  format: 'currency' | 'number' | 'percentage';
}

export function MetricCard({ label, value, previousValue, format }: MetricCardProps) {
  const change = previousValue > 0
    ? ((value - previousValue) / previousValue) * 100
    : 0;

  const isPositive = change > 0;
  const isNeutral = Math.abs(change) < 0.5;

  function formatValue(val: number): string {
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: 'EUR',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(val);
      case 'percentage':
        return `${val.toFixed(1)}%`;
      case 'number':
        return new Intl.NumberFormat('fr-FR').format(val);
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">
        {label}
      </p>
      <p className="text-2xl font-bold text-zinc-50 mt-1">
        {formatValue(value)}
      </p>
      <div className="flex items-center gap-1 mt-2">
        {isNeutral ? (
          <Minus className="h-3 w-3 text-zinc-500" />
        ) : isPositive ? (
          <TrendingUp className="h-3 w-3 text-emerald-500" />
        ) : (
          <TrendingDown className="h-3 w-3 text-red-500" />
        )}
        <span
          className={cn(
            'text-xs font-medium',
            isNeutral
              ? 'text-zinc-500'
              : isPositive
                ? 'text-emerald-500'
                : 'text-red-500'
          )}
        >
          {isNeutral ? '0%' : `${isPositive ? '+' : ''}${change.toFixed(1)}%`}
        </span>
        <span className="text-xs text-zinc-600">vs 7d</span>
      </div>
    </div>
  );
}
