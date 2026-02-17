// src/integrations/gorgias/types.ts

export interface GorgiasWebhookPayload {
  ticket_id: number;
  event: string;
  ticket: {
    id: number;
    subject: string;
    status: string;
    channel: string;
    customer: {
      email: string;
      name: string;
    };
    tags: Array<{ name: string }>;
    messages: Array<{
      body_text: string;
      from_agent: boolean;
      channel: string;
    }>;
    created_datetime: string;
  };
}

export interface GorgiasIntegrationConfig {
  domain: string;
  apiKey: string;
  autoRespondEnabled: boolean;
  escalationTeamId?: number;
  vipTag: string;
  axiomeTag: string;
}

export type GorgiasTicketEvent =
  | 'ticket-created'
  | 'ticket-updated'
  | 'ticket-message-created'
  | 'ticket-closed';
