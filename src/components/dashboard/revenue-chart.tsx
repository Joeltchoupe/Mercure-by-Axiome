// src/components/dashboard/revenue-chart.tsx

'use client';

import { useMemo } from 'react';
import type { DailyMetrics } from '@/types/store';

interface RevenueChartProps {
  data: DailyMetrics[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  const maxRevenue = useMemo(
    () => Math.max(...data.map((d) => d.revenue), 1),
    [data]
  );

  const maxOrders = useMemo(
    () => Math.max(...data.map((d) => d.orders), 1),
    [data]
  );

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm font-semibold text-zinc-200">Revenue — 30 Days</h2>
        <div className="flex items-center gap-4">
          <Legend color="bg-amber-500" label="Revenue" />
          <Legend color="bg-zinc-600" label="Orders" />
        </div>
      </div>

      <div className="flex items-end gap-1 h-48">
        {data.map((day, i) => {
          const revenueHeight = (day.revenue / maxRevenue) * 100;
          const ordersHeight = (day.orders / maxOrders) * 100;

          return (
            <div
              key={day.date}
              className="flex-1 flex flex-col items-center gap-1 group relative"
            >
              {/* Tooltip */}
              <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
                <p className="text-xs text-zinc-400">
                  {new Date(day.date).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </p>
                <p className="text-xs text-amber-500 font-medium">
                  {new Intl.NumberFormat('fr-FR', {
                    style: 'currency',
                    currency: 'EUR',
                    minimumFractionDigits: 0,
                  }).format(day.revenue)}
                </p>
                <p className="text-xs text-zinc-500">{day.orders} orders</p>
              </div>

              {/* Bars */}
              <div className="w-full flex items-end gap-px h-full">
                <div
                  className="flex-1 bg-amber-500/80 rounded-t-sm transition-all group-hover:bg-amber-500"
                  style={{ height: `${revenueHeight}%`, minHeight: day.revenue > 0 ? '2px' : '0' }}
                />
                <div
                  className="flex-1 bg-zinc-600/50 rounded-t-sm transition-all group-hover:bg-zinc-500"
                  style={{ height: `${ordersHeight}%`, minHeight: day.orders > 0 ? '2px' : '0' }}
                />
              </div>

              {/* Date label (every 5th) */}
              {i % 5 === 0 && (
                <span className="text-[9px] text-zinc-600 mt-1">
                  {new Date(day.date).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-[10px] text-zinc-500">{label}</span>
    </div>
  );
}
