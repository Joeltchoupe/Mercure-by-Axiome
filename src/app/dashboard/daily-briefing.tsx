// src/components/dashboard/daily-briefing.tsx

import { Brain, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import type { DailyMetrics } from '@/types/store';
import type { AgentRun } from '@/types/agent';

interface DailyBriefingProps {
  todayMetrics: DailyMetrics | null;
  yesterdayMetrics: DailyMetrics | null;
  recentRuns: AgentRun[];
  storeName: string;
}

export function DailyBriefing({
  todayMetrics,
  yesterdayMetrics,
  recentRuns,
  storeName,
}: DailyBriefingProps) {
  const successRuns = recentRuns.filter((r) => r.status === 'success').length;
  const errorRuns = recentRuns.filter((r) => r.status === 'error').length;
  const totalActions = recentRuns.filter((r) => r.decision?.action !== 'NO_ACTION').length;

  const revenueChange =
    todayMetrics && yesterdayMetrics && yesterdayMetrics.revenue > 0
      ? ((todayMetrics.revenue - yesterdayMetrics.revenue) / yesterdayMetrics.revenue) * 100
      : 0;

  return (
    <div className="bg-gradient-to-r from-zinc-900 to-zinc-900/50 border border-zinc-800 rounded-xl p-6">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
          <Brain className="h-5 w-5 text-amber-500" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-zinc-300">
            Daily Briefing — {storeName.replace('.myshopify.com', '')}
          </h2>
          <div className="mt-3 space-y-2">
            {todayMetrics && (
              <BriefingLine
                icon={TrendingUp}
                iconColor="text-emerald-500"
                text={`Revenue aujourd'hui : ${formatCurrency(todayMetrics.revenue)} (${revenueChange >= 0 ? '+' : ''}${revenueChange.toFixed(0)}% vs hier) — ${todayMetrics.orders} commandes`}
              />
            )}
            <BriefingLine
              icon={CheckCircle}
              iconColor="text-blue-500"
              text={`${totalActions} actions agents exécutées — ${successRuns} succès`}
            />
            {errorRuns > 0 && (
              <BriefingLine
                icon={AlertTriangle}
                iconColor="text-amber-500"
                text={`${errorRuns} erreurs agents détectées. Vérifiez l'onglet Activity.`}
              />
            )}
            {errorRuns === 0 && (
              <BriefingLine
                icon={CheckCircle}
                iconColor="text-emerald-500"
                text="Aucune erreur. Le système tourne proprement."
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BriefingLine({
  icon: Icon,
  iconColor,
  text,
}: {
  icon: React.ElementType;
  iconColor: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className={`h-3.5 w-3.5 mt-0.5 ${iconColor}`} />
      <p className="text-sm text-zinc-400">{text}</p>
    </div>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
  }).format(value);
    }
