// src/components/dashboard/agent-performance-chart.tsx

'use client';

import type { AgentType } from '@/types/agent';

interface DailyAgentStat {
  date: string;
  totalRuns: number;
  totalActions: number;
  successRate: number;
  avgDurationMs: number;
}

interface AgentPerformanceChartProps {
  data: DailyAgentStat[];
  agentType: AgentType;
}

export function AgentPerformanceChart({
  data,
  agentType,
}: AgentPerformanceChartProps) {
  const maxRuns = Math.max(...data.map((d) => d.totalRuns), 1);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-zinc-200 mb-4">
        Performance — 30 Days
      </h2>

      <div className="flex items-end gap-1 h-48">
        {data.map((day, i) => {
          const height = (day.totalRuns / maxRuns) * 100;
          const successRatio = day.successRate / 100;

          return (
            <div
              key={day.date}
              className="flex-1 flex flex-col items-center group relative"
            >
              {/* Tooltip */}
              <div className="absolute -top-20 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
                <p className="text-xs text-zinc-400">
                  {new Date(day.date).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </p>
                <p className="text-xs text-zinc-300">{day.totalRuns} runs</p>
                <p className="text-xs text-zinc-300">
                  {day.totalActions} actions
                </p>
                <p className="text-xs text-emerald-500">
                  {day.successRate.toFixed(0)}% success
                </p>
                <p className="text-xs text-zinc-500">
                  avg {day.avgDurationMs.toFixed(0)}ms
                </p>
              </div>

              {/* Bar — colored by success rate */}
              <div
                className="w-full rounded-t-sm transition-all group-hover:opacity-80"
                style={{
                  height: `${height}%`,
                  minHeight: day.totalRuns > 0 ? '2px' : '0',
                  backgroundColor: `hsl(${successRatio * 120}, 60%, 45%)`,
                }}
              />

              {i % 7 === 0 && (
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

      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] text-zinc-500">High success</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-[10px] text-zinc-500">Low success</span>
          </div>
        </div>
      </div>
    </div>
  );
      }
