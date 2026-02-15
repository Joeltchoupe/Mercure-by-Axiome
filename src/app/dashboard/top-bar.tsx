// src/components/dashboard/top-bar.tsx

'use client';

import { Bell, Search } from 'lucide-react';
import type { Store } from '@/types/store';

interface TopBarProps {
  store: Store;
}

export function TopBar({ store }: TopBarProps) {
  return (
    <header className="h-16 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between px-6">
      {/* Search */}
      <div className="flex items-center gap-2 bg-zinc-900 rounded-lg px-3 py-2 w-80">
        <Search className="h-4 w-4 text-zinc-500" />
        <input
          type="text"
          placeholder="Search events, customers, decisions..."
          className="bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 outline-none w-full"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        {/* System status indicator */}
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-zinc-500">System active</span>
        </div>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-zinc-900 transition-colors">
          <Bell className="h-4 w-4 text-zinc-400" />
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-amber-500 rounded-full text-[9px] font-bold text-zinc-950 flex items-center justify-center">
            3
          </span>
        </button>
      </div>
    </header>
  );
}
