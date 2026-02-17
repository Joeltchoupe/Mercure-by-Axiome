// src/integrations/klaviyo/client.ts

import { logger } from '@/lib/logger';

const KLAVIYO_BASE_URL = 'https://a.]klaviyo.com/api';
const KLAVIYO_REVISION = '2024-10-15';

interface KlaviyoRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: Record<string, unknown>;
  query?: Record<string, string>;
}

export class KlaviyoClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  // ─── Core Request ───

  private async request<T>(
    endpoint: string,
    options: KlaviyoRequestOptions = {}
  ): Promise<T> {
    const { method = 'GET', body, query } = options;

    let url = `${KLAVIYO_BASE_URL}${endpoint}`;

    if (query) {
      const params = new URLSearchParams(query);
      url += `?${params.toString()}`;
    }

    const headers: Record<string, string> = {
      Authorization: `Klaviyo-API-Key ${this.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      revision: KLAVIYO_REVISION,
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
      logger.warn('Klaviyo rate limited', { endpoint, retryAfter });
      await sleep(retryAfter * 1000);
      return this.request<T>(endpoint, options);
    }

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('Klaviyo API error', {
        endpoint,
        status: response.status,
        body: errorBody.substring(0, 500),
      });
      throw new Error(`Klaviyo API error: ${response.status}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  // ─── Profiles ───

  async getProfile(
    email: string
  ): Promise<KlaviyoProfile | null> {
    try {
      const data = await this.request<{ data: KlaviyoProfile[] }>(
        '/profiles',
        {
          query: {
            'filter': `equals(email,"${email}")`,
          },
        }
      );

      return data.data?.[0] ?? null;
    } catch {
      return null;
    }
  }

  async createOrUpdateProfile(params: {
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    properties?: Record<string, unknown>;
  }): Promise<KlaviyoProfile> {
    const attributes: Record<string, unknown> = {
      email: params.email,
    };

    if (params.firstName) attributes.first_name = params.firstName;
    if (params.lastName) attributes.last_name = params.lastName;
    if (params.phone) attributes.phone_number = params.phone;
    if (params.properties) attributes.properties = params.properties;

    const data = await this.request<{ data: KlaviyoProfile }>(
      '/profile-import',
      {
        method: 'POST',
        body: {
          data: {
            type: 'profile',
            attributes,
          },
        },
      }
    );

    return data.data;
  }

  async updateProfile(
    email: string,
    properties: Record<string, unknown>
  ): Promise<void> {
    const profile = await this.getProfile(email);

    if (!profile) {
      await this.createOrUpdateProfile({ email, properties });
      return;
    }

    await this.request(`/profiles/${profile.id}`, {
      method: 'PATCH',
      body: {
        data: {
          type: 'profile',
          id: profile.id,
          attributes: {
            properties,
          },
        },
      },
    });
  }

  // ─── Lists ───

  async addProfileToList(
    listId: string,
    profile: {
      email: string;
      firstName?: string;
      lastName?: string;
      properties?: Record<string, unknown>;
    }
  ): Promise<void> {
    // Ensure profile exists
    await this.createOrUpdateProfile(profile);

    const klaviyoProfile = await this.getProfile(profile.email);
    if (!klaviyoProfile) {
      throw new Error(`Failed to find/create profile for ${profile.email}`);
    }

    await this.request(`/lists/${listId}/relationships/profiles`, {
      method: 'POST',
      body: {
        data: [
          {
            type: 'profile',
            id: klaviyoProfile.id,
          },
        ],
      },
    });
  }

  async removeProfileFromList(
    listId: string,
    profileId: string
  ): Promise<void> {
    await this.request(`/lists/${listId}/relationships/profiles`, {
      method: 'DELETE',
      body: {
        data: [
          {
            type: 'profile',
            id: profileId,
          },
        ],
      },
    });
  }

  async getLists(): Promise<KlaviyoList[]> {
    const data = await this.request<{ data: KlaviyoList[] }>('/lists');
    return data.data ?? [];
  }

  // ─── Events (Track) ───

  async trackEvent(params: {
    email: string;
    eventName: string;
    properties?: Record<string, unknown>;
    value?: number;
    time?: Date;
  }): Promise<void> {
    await this.request('/events', {
      method: 'POST',
      body: {
        data: {
          type: 'event',
          attributes: {
            metric: {
              data: {
                type: 'metric',
                attributes: {
                  name: params.eventName,
                },
              },
            },
            profile: {
              data: {
                type: 'profile',
                attributes: {
                  email: params.email,
                },
              },
            },
            properties: params.properties ?? {},
            value: params.value,
            time: (params.time ?? new Date()).toISOString(),
          },
        },
      },
    });
  }

  // ─── Flows ───

  async triggerFlow(
    flowId: string,
    params: {
      email: string;
      properties?: Record<string, unknown>;
    }
  ): Promise<void> {
    // Klaviyo flows are triggered by events, not direct API calls
    // We track a custom event that the flow listens to
    await this.trackEvent({
      email: params.email,
      eventName: `axiome_flow_trigger_${flowId}`,
      properties: {
        flow_id: flowId,
        ...params.properties,
      },
    });
  }

  // ─── Segments ───

  async getSegments(): Promise<KlaviyoSegment[]> {
    const data = await this.request<{ data: KlaviyoSegment[] }>(
      '/segments'
    );
    return data.data ?? [];
  }

  // ─── Health Check ───

  async healthCheck(): Promise<boolean> {
    try {
      await this.request('/lists', { query: { 'page[size]': '1' } });
      return true;
    } catch {
      return false;
    }
  }
}

// ─── Types ───

export interface KlaviyoProfile {
  id: string;
  type: 'profile';
  attributes: {
    email: string;
    first_name: string | null;
    last_name: string | null;
    phone_number: string | null;
    properties: Record<string, unknown>;
    created: string;
    updated: string;
  };
}

export interface KlaviyoList {
  id: string;
  type: 'list';
  attributes: {
    name: string;
    created: string;
    updated: string;
  };
}

export interface KlaviyoSegment {
  id: string;
  type: 'segment';
  attributes: {
    name: string;
    created: string;
    updated: string;
  };
}

// ─── Helpers ───

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
