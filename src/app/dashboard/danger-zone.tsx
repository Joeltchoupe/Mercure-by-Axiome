// src/components/dashboard/danger-zone.tsx

'use client';

import { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { uninstallApp } from '@/app/dashboard/settings/actions';

interface DangerZoneProps {
  storeId: string;
}

export function DangerZone({ storeId }: DangerZoneProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="bg-zinc-900 border border-red-900/30 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <AlertTriangle className="h-5 w-5 text-red-500" />
        <h2 className="text-lg font-semibold text-red-400">Danger Zone</h2>
      </div>

      {!confirmOpen ? (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-300">Uninstall Axiome</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              Désactive tous les agents et supprime la connexion. Irréversible.
            </p>
          </div>
          <button
            onClick={() => setConfirmOpen(true)}
            className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Uninstall
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-red-400">
            Êtes-vous sûr ? Tous les agents seront désactivés et les données supprimées.
          </p>
          <div className="flex items-center gap-3">
            <form action={uninstallApp}>
              <input type="hidden" name="storeId" value={storeId} />
              <button
                type="submit"
                className="bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                Confirm Uninstall
              </button>
            </form>
            <button
              onClick={() => setConfirmOpen(false)}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
          }
