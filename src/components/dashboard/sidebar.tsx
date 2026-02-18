// src/components/dashboard/sidebar.tsx

'use client';

import Link from 'next/link';
import { CreditCard } from 'lucide-react';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Bot,
  Activity,
  Settings,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Store } from '@/types/store';

interface SidebarProps {
  store: Store;
}

const NAV_ITEMS = [
  {
    label: 'Overview',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
  label: 'Billing',
  href: '/dashboard/billing',
  icon: CreditCard,
  },
  {
    label: 'Agents',
    href: '/dashboard/agents',
    icon: Bot,
  },
  {
    label: 'Activity',
    href: '/dashboard/activity',
    icon: Activity,
  },
  {
    label: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
  },
];

export function Sidebar({ store }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-zinc-800 bg-zinc-950 flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-zinc-800">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Zap className="h-6 w-6 text-amber-500" />
          <span className="text-lg font-bold text-zinc-50">Axiome</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-zinc-800 text-zinc-50'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Store info */}
      <div className="p-4 border-t border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
            <span className="text-xs font-bold text-zinc-400">
              {store.shopifyDomain.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-200 truncate">
              {store.shopifyDomain.replace('.myshopify.com', '')}
            </p>
            <p className="text-xs text-zinc-500">{store.plan ?? 'Free'}</p>
          </div>
        </div>
      </div>
    </aside>
  );
      }
