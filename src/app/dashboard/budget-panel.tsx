// src/components/dashboard/budget-panel.tsx

'use client';

import { useState } from 'react';
import { Save, DollarSign } from 'lucide-react';
import { updateBudget } from '@/app/dashboard/settings/actions';
import type { Store } from '@/types/store';

interface BudgetPanelProps {
  store: Store;
}

export function BudgetPanel({ store }: BudgetPanelProps) {
  const [dailyBudget, setDailyBudget] = useState(
    store.settings?.dailyLlmBudgetUsd?.toString() ?? '25'
  );
  const [monthlyBudget, setMonthlyBudget] = useState(
    store.settings?.monthlyLlmBudgetUsd?.toString() ?? '500'
  );

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <DollarSign className="h-5 w-5 text-amber-500" />
        <h2 className="text-lg font-semibold text-zinc-200">AI Budget</h2>
      </div>
      <p className="text-xs text-zinc-500 mb-4">
        Contrôlez combien vos agents peuvent dépenser en appels LLM par jour et par mois.
        Les agents s'arrêtent automatiquement quand le budget est atteint.
      </p>

      <form action={updateBudget} className="space-y-4 max-w-md">
        <input type="hidden" name="storeId" value={store.id} />

        <div>
          <label className="block text-xs text-zinc-500 font-medium mb-1.5">
            Daily Budget (USD)
          </label>
          <input
            type="number"
            name="dailyBudget"
            value={dailyBudget}
            onChange={(e) => setDailyBudget(e.target.value)}
            min={1}
            max={1000}
            step={1}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-500 transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs text-zinc-500 font-medium mb-1.5">
            Monthly Budget (USD)
          </label>
          <input
            type="number"
            name="monthlyBudget"
            value={monthlyBudget}
            onChange={(e) => setMonthlyBudget(e.target.value)}
            min={10}
            max={10000}
            step={10}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-500 transition-colors"
          />
        </div>

        <button
          type="submit"
          className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
        >
          <Save className="h-4 w-4" />
          Save Budget
        </button>
      </form>
    </div>
  );
    }
