// src/app/dashboard/layout.tsx

import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/dashboard/sidebar';
import { TopBar } from '@/components/dashboard/top-bar';
import { getAuthenticatedStore } from '@/lib/auth';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const store = await getAuthenticatedStore();

  if (!store) {
    redirect('/install');
  }

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      <Sidebar store={store} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar store={store} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
