// src/app/dashboard/agents/actions.ts

'use server';

import { revalidatePath } from 'next/cache';
import { AgentConfigRepo } from '@/data/repositories/agent-config.repo';
import type { AgentType } from '@/types/agent';

export async function toggleAgent(formData: FormData) {
  const storeId = formData.get('storeId') as string;
  const agentType = formData.get('agentType') as AgentType;
  const enabled = formData.get('enabled') === 'true';

  if (!storeId || !agentType) {
    throw new Error('Missing required fields');
  }

  const agentConfigRepo = new AgentConfigRepo();
  await agentConfigRepo.upsertConfig(storeId, agentType, { enabled });

  revalidatePath('/dashboard/agents');
  revalidatePath(`/dashboard/agents/${agentType}`);
  revalidatePath('/dashboard');
}

export async function updateAgentConfig(formData: FormData) {
  const storeId = formData.get('storeId') as string;
  const agentType = formData.get('agentType') as AgentType;
  const maxActionsPerHour = parseInt(
    formData.get('maxActionsPerHour') as string,
    10
  );
  const maxCostPerDayUsd = parseFloat(
    formData.get('maxCostPerDayUsd') as string
  );
  const llmModel = formData.get('llmModel') as string;

  if (!storeId || !agentType) {
    throw new Error('Missing required fields');
  }

  const agentConfigRepo = new AgentConfigRepo();
  await agentConfigRepo.upsertConfig(storeId, agentType, {
    maxActionsPerHour: isNaN(maxActionsPerHour) ? undefined : maxActionsPerHour,
    maxCostPerDayUsd: isNaN(maxCostPerDayUsd) ? undefined : maxCostPerDayUsd,
    llmModel: llmModel || undefined,
  });

  revalidatePath(`/dashboard/agents/${agentType}`);
    }
