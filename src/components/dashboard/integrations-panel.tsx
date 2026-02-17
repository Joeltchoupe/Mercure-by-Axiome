// src/components/dashboard/integrations-panel.tsx

'use client';

import {
  Link2,
  Unlink,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Integration } from '@/types/integration';

interface IntegrationsPanelProps {
  integrations: Integration[];
  storeId: string;
}

const AVAILABLE_INTEGRATIONS = [
  {
    provider: 'shopify',
    label: 'Shopify',
    description: 'Your store. Always connected.',
    required: true,
  },
  {
    provider: 'klaviyo',
    label: 'Klaviyo',
    description: 'Email & SMS marketing automation.',
    required: false,
  },
  {
    provider: 'gorgias',
    label: 'Gorgias',
    description: 'Customer support helpdesk.',
    required: false,
  },
];

export function IntegrationsPanel({
  integrations,
  storeId,
}: IntegrationsPanelProps) {
  const connectedProviders = new Set(integrations.map((i) => i.provider));

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-zinc-200 mb-4">Integrations</h2>

      <div className="space-y-3">
        {AVAILABLE_INTEGRATIONS.map((integration) => {
          const isConnected = connectedProviders.has(integration.provider);

          return (
            <div
              key={integration.provider}
              className="flex items-center justify-between py-3 px-4 bg-zinc-800/30 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center',
                    isConnected ? 'bg-emerald-500/10' : 'bg-zinc-800'
                  )}
                >
                  {isConnected ? (
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Link2 className="h-4 w-4 text-zinc-500" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-200">
                    {integration.label}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {integration.description}
                  </p>
                </div>
              </div>

              {integration.required ? (
                <span className="text-xs text-emerald-500 font-medium">
                  Connected
                </span>
              ) : isConnected ? (
                <button className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors">
                  <Unlink className="h-3 w-3" />
                  Disconnect
                </button>
              ) : (
                <button className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors">
                  <ExternalLink className="h-3 w-3" />
                  Connect
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
      }
