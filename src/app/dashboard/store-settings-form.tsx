// src/components/dashboard/store-settings-form.tsx

'use client';

import { useState } from 'react';
import { Save } from 'lucide-react';
import { updateStoreSettings } from '@/app/dashboard/settings/actions';
import type { Store } from '@/types/store';

interface StoreSettingsFormProps {
  store: Store;
}

export function StoreSettingsForm({ store }: StoreSettingsFormProps) {
  const [timezone, setTimezone] = useState(
    store.settings?.timezone ?? 'Europe/Paris'
  );
  const [currency, setCurrency] = useState(
    store.settings?.currency ?? 'EUR'
  );
  const [notificationEmail, setNotificationEmail] = useState(
    store.settings?.notificationEmail ?? ''
  );

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-zinc-200 mb-4">Store Settings</h2>

      <form action={updateStoreSettings} className="space-y-4 max-w-md">
        <input type="hidden" name="storeId" value={store.id} />

        <div>
          <label className="block text-xs text-zinc-500 font-medium mb-1.5">
            Store Domain
          </label>
          <input
            type="text"
            value={store.shopifyDomain}
            disabled
            className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-500"
          />
        </div>

        <div>
          <label className="block text-xs text-zinc-500 font-medium mb-1.5">
            Timezone
          </label>
          <select
            name="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-500 transition-colors cursor-pointer"
          >
            <option value="Europe/Paris">Europe/Paris (CET)</option>
            <option value="America/New_York">America/New_York (EST)</option>
            <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
            <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
            <option value="UTC">UTC</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-zinc-500 font-medium mb-1.5">
            Currency
          </label>
          <select
            name="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-500 transition-colors cursor-pointer"
          >
            <option value="EUR">EUR (€)</option>
            <option value="USD">USD ($)</option>
            <option value="GBP">GBP (£)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-zinc-500 font-medium mb-1.5">
            Notification Email
          </label>
          <input
            type="email"
            name="notificationEmail"
            value={notificationEmail}
            onChange={(e) => setNotificationEmail(e.target.value)}
            placeholder="you@company.com"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-zinc-500 transition-colors"
          />
        </div>

        <button
          type="submit"
          className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
        >
          <Save className="h-4 w-4" />
          Save Settings
        </button>
      </form>
    </div>
  );
      }
