// src/core/memory/memory-manager.ts

import { VectorStore, VectorNamespace } from '@/core/memory/vector-store';
import { logger } from '@/lib/logger';
import type { AgentRun, AgentType } from '@/types/agent';

export class MemoryManager {
  private vectorStore: VectorStore;

  constructor() {
    this.vectorStore = new VectorStore();
  }

  // ─── Customer Memory ───

  async storeCustomerProfile(params: {
    storeId: string;
    customerId: string;
    email: string;
    profile: {
      name: string;
      totalOrders: number;
      totalSpent: number;
      preferences: string[];
      recentProducts: string[];
      supportHistory: string[];
    };
  }): Promise<void> {
    const content = this.buildCustomerProfileText(params.profile);

    await this.vectorStore.upsert({
      id: `customer:${params.storeId}:${params.customerId}`,
      storeId: params.storeId,
      namespace: 'customer_profile',
      content,
      metadata: {
        customerId: params.customerId,
        email: params.email,
        totalOrders: params.profile.totalOrders,
        totalSpent: params.profile.totalSpent,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  async findSimilarCustomers(
    storeId: string,
    customerProfile: string,
    limit: number = 5
  ): Promise<Array<{ customerId: string; similarity: number }>> {
    const results = await this.vectorStore.search({
      storeId,
      query: customerProfile,
      namespace: 'customer_profile',
      limit,
      minSimilarity: 0.75,
    });

    return results.map((r) => ({
      customerId: r.metadata.customerId as string,
      similarity: r.similarity,
    }));
  }

  // ─── Product Memory ───

  async storeProductDescription(params: {
    storeId: string;
    productId: string;
    title: string;
    description: string;
    tags: string[];
    price: number;
    category: string;
  }): Promise<void> {
    const content = [
      `Product: ${params.title}`,
      `Description: ${params.description}`,
      `Category: ${params.category}`,
      `Tags: ${params.tags.join(', ')}`,
      `Price: ${params.price}€`,
    ].join('\n');

    await this.vectorStore.upsert({
      id: `product:${params.storeId}:${params.productId}`,
      storeId: params.storeId,
      namespace: 'product_description',
      content,
      metadata: {
        productId: params.productId,
        title: params.title,
        price: params.price,
        category: params.category,
        tags: params.tags,
      },
    });
  }

  async findRelatedProducts(
    storeId: string,
    query: string,
    limit: number = 5
  ): Promise<
    Array<{
      productId: string;
      title: string;
      price: number;
      similarity: number;
    }>
  > {
    const results = await this.vectorStore.search({
      storeId,
      query,
      namespace: 'product_description',
      limit,
      minSimilarity: 0.65,
    });

    return results.map((r) => ({
      productId: r.metadata.productId as string,
      title: r.metadata.title as string,
      price: r.metadata.price as number,
      similarity: r.similarity,
    }));
  }

  // ─── Support Memory ───

  async storeSupportTicket(params: {
    storeId: string;
    ticketId: string;
    subject: string;
    content: string;
    resolution: string;
    category: string;
    customerEmail: string;
  }): Promise<void> {
    const text = [
      `Issue: ${params.subject}`,
      `Details: ${params.content}`,
      `Resolution: ${params.resolution}`,
      `Category: ${params.category}`,
    ].join('\n');

    await this.vectorStore.upsert({
      id: `ticket:${params.storeId}:${params.ticketId}`,
      storeId: params.storeId,
      namespace: 'support_ticket',
      content: text,
      metadata: {
        ticketId: params.ticketId,
        category: params.category,
        customerEmail: params.customerEmail,
        resolvedAt: new Date().toISOString(),
      },
    });
  }

  async findSimilarTickets(
    storeId: string,
    issue: string,
    limit: number = 3
  ): Promise<
    Array<{
      ticketId: string;
      content: string;
      category: string;
      similarity: number;
    }>
  > {
    const results = await this.vectorStore.search({
      storeId,
      query: issue,
      namespace: 'support_ticket',
      limit,
      minSimilarity: 0.72,
    });

    return results.map((r) => ({
      ticketId: r.metadata.ticketId as string,
      content: r.content,
      category: r.metadata.category as string,
      similarity: r.similarity,
    }));
  }

  // ─── Agent Decision Memory ───

  async storeAgentDecision(
    storeId: string,
    run: AgentRun
  ): Promise<void> {
    if (!run.decision || run.decision.action === 'NO_ACTION') return;

    const content = [
      `Agent: ${run.agentType}`,
      `Action: ${run.decision.action}`,
      `Reasoning: ${run.decision.reasoning}`,
      `Confidence: ${run.decision.confidence}`,
      `Result: ${run.status}`,
    ].join('\n');

    await this.vectorStore.upsert({
      id: `decision:${storeId}:${run.id}`,
      storeId,
      namespace: 'agent_decision',
      content,
      metadata: {
        agentType: run.agentType,
        action: run.decision.action,
        confidence: run.decision.confidence,
        status: run.status,
        createdAt: run.createdAt.toISOString(),
      },
    });
  }

  async findSimilarDecisions(
    storeId: string,
    context: string,
    agentType?: AgentType,
    limit: number = 5
  ): Promise<
    Array<{
      action: string;
      reasoning: string;
      confidence: number;
      status: string;
      similarity: number;
    }>
  > {
    const results = await this.vectorStore.search({
      storeId,
      query: context,
      namespace: 'agent_decision',
      limit: limit * 2, // Get more, filter after
      minSimilarity: 0.7,
    });

    let filtered = results;
    if (agentType) {
      filtered = results.filter(
        (r) => r.metadata.agentType === agentType
      );
    }

    return filtered.slice(0, limit).map((r) => ({
      action: r.metadata.action as string,
      reasoning: r.content,
      confidence: r.metadata.confidence as number,
      status: r.metadata.status as string,
      similarity: r.similarity,
    }));
  }

  // ─── Store Knowledge ───

  async storeKnowledge(params: {
    storeId: string;
    key: string;
    content: string;
    category: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.vectorStore.upsert({
      id: `knowledge:${params.storeId}:${params.key}`,
      storeId: params.storeId,
      namespace: 'store_knowledge',
      content: params.content,
      metadata: {
        key: params.key,
        category: params.category,
        ...params.metadata,
      },
    });
  }

  async searchKnowledge(
    storeId: string,
    query: string,
    limit: number = 5
  ): Promise<
    Array<{
      key: string;
      content: string;
      category: string;
      similarity: number;
    }>
  > {
    const results = await this.vectorStore.search({
      storeId,
      query,
      namespace: 'store_knowledge',
      limit,
      minSimilarity: 0.65,
    });

    return results.map((r) => ({
      key: r.metadata.key as string,
      content: r.content,
      category: r.metadata.category as string,
      similarity: r.similarity,
    }));
  }

  // ─── Cleanup ───

  async clearStoreMemory(storeId: string): Promise<number> {
    return this.vectorStore.deleteByStore(storeId);
  }

  async clearNamespace(
    storeId: string,
    namespace: VectorNamespace
  ): Promise<number> {
    return this.vectorStore.deleteByNamespace(storeId, namespace);
  }

  async getMemoryStats(
    storeId: string
  ): Promise<Record<VectorNamespace, number>> {
    const namespaces: VectorNamespace[] = [
      'customer_profile',
      'product_description',
      'support_ticket',
      'agent_decision',
      'store_knowledge',
    ];

    const stats: Record<string, number> = {};

    for (const ns of namespaces) {
      stats[ns] = await this.vectorStore.getDocumentCount(storeId, ns);
    }

    return stats as Record<VectorNamespace, number>;
  }

  // ─── Helpers ───

  private buildCustomerProfileText(profile: {
    name: string;
    totalOrders: number;
    totalSpent: number;
    preferences: string[];
    recentProducts: string[];
    supportHistory: string[];
  }): string {
    const parts = [
      `Customer: ${profile.name}`,
      `Orders: ${profile.totalOrders}`,
      `Total spent: ${profile.totalSpent}€`,
    ];

    if (profile.preferences.length > 0) {
      parts.push(`Preferences: ${profile.preferences.join(', ')}`);
    }

    if (profile.recentProducts.length > 0) {
      parts.push(`Recent products: ${profile.recentProducts.join(', ')}`);
    }

    if (profile.supportHistory.length > 0) {
      parts.push(`Support history: ${profile.supportHistory.join('; ')}`);
    }

    return parts.join('\n');
  }
}
