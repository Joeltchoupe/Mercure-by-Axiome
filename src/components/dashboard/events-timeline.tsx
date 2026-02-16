// src/components/dashboard/events-timeline.tsx

import Link from 'next/link';
import {
  ShoppingCart,
  Eye,
  CreditCard,
  UserPlus,
  MessageSquare,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from '@/lib/utils';
import type { AgentEvent } from '@/types/event';
import type { AgentRun } from '@/types/agent';

interface TimelineItem {
  event: AgentEvent;
  agentRun: AgentRun | null;
}

interface EventsTimelineProps {
  items: TimelineItem[];
  currentPage: number;
  totalPages: number;
}

const EVENT_ICONS: Record<string, React.ElementType> = {
  'order.created': ShoppingCart,
  'order.fulfilled': ShoppingCart,
  'checkout.started': CreditCard,
  'checkout.completed': CreditCard,
  'product.viewed': Eye,
  'customer.created': UserPlus,
  'cart.updated': ShoppingCart,
  'support.ticket.created': MessageSquare,
  'support.ticket.resolved': MessageSquare,
};

const EVENT_COLORS: Record<string, string> = {
  'order.created': 'bg-emerald-500',
  'order.fulfilled': 'bg-emerald-500',
  'checkout.started': 'bg-blue-500',
  'checkout.completed': 'bg-blue-500',
  'product.viewed': 'bg-zinc-500',
  'customer.created': 'bg-purple-500',
  'cart.updated': 'bg-amber-500',
  'support.ticket.created': 'bg-red-500',
  'support.ticket.resolved': 'bg-green-500',
};

export function EventsTimeline({
  items,
  currentPage,
  totalPages,
}: EventsTimelineProps) {
  if (items.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
        <p className="text-sm text-zinc-500">No events found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800/50">
        {items.map((item) => (
          <TimelineRow key={item.event.id} item={item} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-500">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            {currentPage > 1 && (
              <Link
                href={`/dashboard/activity?page=${currentPage - 1}`}
                className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 rounded-lg text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                <ChevronLeft className="h-3 w-3" />
                Previous
              </Link>
            )}
            {currentPage < totalPages && (
              <Link
                href={`/dashboard/activity?page=${currentPage + 1}`}
                className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 rounded-lg text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                Next
                <ChevronRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineRow({ item }: { item: TimelineItem }) {
  const { event, agentRun } = item;
  const Icon = EVENT_ICONS[event.type] ?? Eye;
  const dotColor = EVENT_COLORS[event.type] ?? 'bg-zinc-500';

  return (
    <div className="px-5 py-4">
      <div className="flex items-start gap-4">
        {/* Timeline dot */}
        <div className="flex flex-col items-center pt-1">
          <div className={cn('w-2.5 h-2.5 rounded-full', dotColor)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Icon className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-sm font-medium text-zinc-200">
              {event.type}
            </span>
            <span className="text-xs text-zinc-600">
              {formatDistanceToNow(event.receivedAt)}
            </span>
          </div>

          {/* Event source */}
          <p className="text-xs text-zinc-500 mt-1">
            Source: {event.source}
          </p>

          {/* Agent action if any */}
          {agentRun && (
            <div className="mt-2 flex items-center gap-2 bg-zinc-800/50 rounded-lg px-3 py-2">
              <ArrowRight className="h-3 w-3 text-zinc-500" />
              <span className="text-xs text-zinc-400 uppercase font-medium">
                {agentRun.agentType}
              </span>
              <span className="text-xs text-zinc-300">
                → {agentRun.decision?.action}
              </span>
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full font-medium ml-auto',
                  agentRun.status === 'success'
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : agentRun.status === 'error'
                      ? 'bg-red-500/10 text-red-500'
                      : 'bg-zinc-700 text-zinc-400'
                )}
              >
                {agentRun.status}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
          }
