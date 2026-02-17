// src/components/dashboard/agent-config-panel.tsx

'use client';

import { useState } from 'react';
import { Save } from 'lucide-react';
import { updateAgentConfig } from '@/app/dashboard/agents/actions';
import type { AgentType } from '@/types/agent';

interface AgentConfigPanelProps {
  agentType: AgentType;
  config: {
    enabled?: boolean;
    priority?: number;
    maxActionsPerHour?: number;
    llmModel?: string;
    maxCostPerDayUsd?: number;
    [key: string]: unknown;
  };
  storeId: string;
}

export function AgentConfigPanel({
  agentType,
  config,
  storeId,
}: AgentConfigPanelProps) {
  const [maxActions, setMaxActions] = useState(
    config.maxActionsPerHour?.toString() ?? '50'
  );
  const [maxCost, setMaxCost] = useState(
    config.maxCostPerDayUsd?.toString() ?? '5'
  );
  const [model, setModel] = useState(config.llmModel ?? 'gpt-4o-mini');

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-zinc-200 mb-4">Configuration</h2>

      <form action={updateAgentConfig} className="space-y-4">
        <input type="hidden" name="storeId" value={storeId} />
        <input type="hidden" name="agentType" value={agentType} />

        <ConfigField label="Max Actions / Hour">
          <input
            type="number"
            name="maxActionsPerHour"
            value={maxActions}
            onChange={(e) => setMaxActions(e.target.value)}
            min={1}
            max={1000}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-500 transition-colors"
          />
        </ConfigField>

        <ConfigField label="Max Cost / Day (USD)">
          <input
            type="number"
            name="maxCostPerDayUsd"
            value={maxCost}
            onChange={(e) => setMaxCost(e.target.value)}
            min={0.1}
            max={100}
            step={0.1}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-500 transition-colors"
          />
        </ConfigField>

        <ConfigField label="LLM Model">
          <select
            name="llmModel"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-500 transition-colors cursor-pointer"
          >
            <option value="gpt-4o-mini">GPT-4o Mini (fast, cheap)</option>
            <option value="gpt-4o">GPT-4o (balanced)</option>
            <option value="claude-sonnet">Claude Sonnet (reasoning)</option>
          </select>
        </ConfigField>

        <button
          type="submit"
          className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
        >
          <Save className="h-4 w-4" />
          Save Configuration
        </button>
      </form>
    </div>
  );
}

function ConfigField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs text-zinc-500 font-medium mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
      }
