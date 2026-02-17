// src/integrations/gorgias/client.ts

import { logger } from '@/lib/logger';

interface GorgiasRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, unknown>;
  query?: Record<string, string>;
}

export class GorgiasClient {
  private domain: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(domain: string, apiKey: string) {
    this.domain = domain;
    this.apiKey = apiKey;
    this.baseUrl = `https://${domain}.gorgias.com/api`;
  }

  // ─── Core Request ───

  private async request<T>(
    endpoint: string,
    options: GorgiasRequestOptions = {}
  ): Promise<T> {
    const { method = 'GET', body, query } = options;

    let url = `${this.baseUrl}${endpoint}`;

    if (query) {
      const params = new URLSearchParams(query);
      url += `?${params.toString()}`;
    }

    // Gorgias uses email:api_key base64 auth
    const authString = Buffer.from(
      `${this.domain}@axiome.ai:${this.apiKey}`
    ).toString('base64');

    const headers: Record<string, string> = {
      Authorization: `Basic ${authString}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    if (response.status === 429) {
      const retryAfter = parseFloat(
        response.headers.get('Retry-After') ?? '5'
      );
      logger.warn('Gorgias rate limited', { endpoint, retryAfter });
      await sleep(retryAfter * 1000);
      return this.request<T>(endpoint, options);
    }

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('Gorgias API error', {
        endpoint,
        status: response.status,
        body: errorBody.substring(0, 500),
      });
      throw new Error(`Gorgias API error: ${response.status}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  // ─── Tickets ───

  async getTicket(ticketId: number): Promise<GorgiasTicket> {
    return this.request<GorgiasTicket>(`/tickets/${ticketId}`);
  }

  async getTickets(params?: {
    limit?: number;
    cursor?: string;
    status?: string;
    customerEmail?: string;
  }): Promise<{ data: GorgiasTicket[]; meta: { next_cursor?: string } }> {
    const query: Record<string, string> = {};

    if (params?.limit) query.limit = params.limit.toString();
    if (params?.cursor) query.cursor = params.cursor;
    if (params?.status) query.status = params.status;
    if (params?.customerEmail) {
      query['customer__email'] = params.customerEmail;
    }

    return this.request('/tickets', { query });
  }

  async createTicket(params: {
    subject: string;
    message: string;
    customerEmail: string;
    channel?: string;
    tags?: string[];
    assigneeTeamId?: number;
  }): Promise<GorgiasTicket> {
    const ticket = await this.request<GorgiasTicket>('/tickets', {
      method: 'POST',
      body: {
        customer: {
          email: params.customerEmail,
        },
        subject: params.subject,
        channel: params.channel ?? 'email',
        messages: [
          {
            channel: params.channel ?? 'email',
            from_agent: false,
            body_text: params.message,
            body_html: `<p>${params.message}</p>`,
            via: 'api',
            source: {
              type: 'axiome',
            },
          },
        ],
        tags: params.tags?.map((t) => ({ name: t })),
      },
    });

    if (params.assigneeTeamId) {
      await this.request(`/tickets/${ticket.id}`, {
        method: 'PUT',
        body: {
          assignee_team: { id: params.assigneeTeamId },
        },
      });
    }

    return ticket;
  }

  async updateTicket(
    ticketId: number,
    updates: {
      status?: string;
      priority?: string;
      tags?: string[];
      assigneeUserId?: number;
      assigneeTeamId?: number;
    }
  ): Promise<GorgiasTicket> {
    const body: Record<string, unknown> = {};

    if (updates.status) body.status = updates.status;
    if (updates.priority) body.priority = updates.priority;
    if (updates.tags) body.tags = updates.tags.map((t) => ({ name: t }));
    if (updates.assigneeUserId) {
      body.assignee_user = { id: updates.assigneeUserId };
    }
    if (updates.assigneeTeamId) {
      body.assignee_team = { id: updates.assigneeTeamId };
    }

    return this.request<GorgiasTicket>(`/tickets/${ticketId}`, {
      method: 'PUT',
      body,
    });
  }

  async closeTicket(ticketId: number): Promise<GorgiasTicket> {
    return this.updateTicket(ticketId, { status: 'closed' });
  }

  // ─── Messages ───

  async addReply(
    ticketId: number,
    params: {
      message: string;
      isInternal?: boolean;
      channel?: string;
    }
  ): Promise<GorgiasMessage> {
    return this.request<GorgiasMessage>(`/tickets/${ticketId}/messages`, {
      method: 'POST',
      body: {
        channel: params.channel ?? 'email',
        from_agent: true,
        body_text: params.message,
        body_html: `<p>${params.message}</p>`,
        via: 'api',
        source: {
          type: 'axiome',
        },
        ...(params.isInternal && {
          public: false,
        }),
      },
    });
  }

  async addInternalNote(
    ticketId: number,
    note: string
  ): Promise<GorgiasMessage> {
    return this.request<GorgiasMessage>(`/tickets/${ticketId}/messages`, {
      method: 'POST',
      body: {
        channel: 'internal-note',
        from_agent: true,
        body_text: note,
        body_html: `<p>${note}</p>`,
        via: 'api',
        public: false,
        source: {
          type: 'axiome',
        },
      },
    });
  }

  // ─── Tags ───

  async addTags(ticketId: number, tags: string[]): Promise<void> {
    const ticket = await this.getTicket(ticketId);
    const existingTags = (ticket.tags ?? []).map(
      (t: { name: string }) => t.name
    );

    const allTags = [...new Set([...existingTags, ...tags])];

    await this.request(`/tickets/${ticketId}`, {
      method: 'PUT',
      body: {
        tags: allTags.map((t) => ({ name: t })),
      },
    });
  }

  async removeTags(ticketId: number, tagsToRemove: string[]): Promise<void> {
    const ticket = await this.getTicket(ticketId);
    const existingTags = (ticket.tags ?? []).map(
      (t: { name: string }) => t.name
    );

    const remainingTags = existingTags.filter(
      (t: string) => !tagsToRemove.includes(t)
    );

    await this.request(`/tickets/${ticketId}`, {
      method: 'PUT',
      body: {
        tags: remainingTags.map((t: string) => ({ name: t })),
      },
    });
  }

  // ─── Customers ───

  async getCustomer(
    email: string
  ): Promise<GorgiasCustomer | null> {
    try {
      const data = await this.request<{
        data: GorgiasCustomer[];
      }>('/customers', {
        query: { email },
      });

      return data.data?.[0] ?? null;
    } catch {
      return null;
    }
  }

  async getCustomerTickets(
    email: string,
    limit: number = 20
  ): Promise<GorgiasTicket[]> {
    const data = await this.getTickets({
      customerEmail: email,
      limit,
    });

    return data.data ?? [];
  }

  // ─── Stats ───

  async getTicketStats(params?: {
    startDate?: Date;
    endDate?: Date;
  }): Promise<GorgiasTicketStats> {
    const query: Record<string, string> = {};

    if (params?.startDate) {
      query.created_datetime__gte = params.startDate.toISOString();
    }
    if (params?.endDate) {
      query.created_datetime__lte = params.endDate.toISOString();
    }

    const open = await this.request<{ meta: { total_count: number } }>(
      '/tickets',
      { query: { ...query, status: 'open', limit: '1' } }
    );

    const closed = await this.request<{ meta: { total_count: number } }>(
      '/tickets',
      { query: { ...query, status: 'closed', limit: '1' } }
    );

    return {
      open: open.meta?.total_count ?? 0,
      closed: closed.meta?.total_count ?? 0,
      total:
        (open.meta?.total_count ?? 0) + (closed.meta?.total_count ?? 0),
    };
  }

  // ─── Health Check ───

  async healthCheck(): Promise<boolean> {
    try {
      await this.request('/tickets', { query: { limit: '1' } });
      return true;
    } catch {
      return false;
    }
  }
}

// ─── Types ───

export interface GorgiasTicket {
  id: number;
  uri: string;
  external_id: string | null;
  subject: string;
  status: string;
  priority: string;
  channel: string;
  via: string;
  from_agent: boolean;
  customer: {
    id: number;
    email: string;
    name: string;
  };
  assignee_user: { id: number; name: string } | null;
  assignee_team: { id: number; name: string } | null;
  tags: Array<{ name: string }>;
  messages_count: number;
  created_datetime: string;
  updated_datetime: string;
  closed_datetime: string | null;
  last_message_datetime: string;
  last_received_message_datetime: string | null;
  meta: Record<string, unknown>;
}

export interface GorgiasMessage {
  id: number;
  uri: string;
  channel: string;
  from_agent: boolean;
  body_text: string;
  body_html: string;
  public: boolean;
  created_datetime: string;
  source: {
    type: string;
  };
}

export interface GorgiasCustomer {
  id: number;
  email: string;
  name: string;
  firstname: string;
  lastname: string;
  created_datetime: string;
  meta: Record<string, unknown>;
}

export interface GorgiasTicketStats {
  open: number;
  closed: number;
  total: number;
}

// ─── Helpers ───

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
