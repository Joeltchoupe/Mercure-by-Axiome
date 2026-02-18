// src/core/agent-os/orchestrator.ts

import { AgentRegistry } from '@/core/agent-os/agent-registry';
import { BillingGuard } from '@/core/billing/billing-guard';
import { ContextBuilder } from '@/core/agent-os/context-builder';
import { BudgetGuard } from '@/core/agent-os/budget-guard';
import { RateLimiter } from '@/core/agent-os/rate-limiter';
import { AgentRunRepo } from '@/data/repositories/agent-run.repo';
import { EventRepo } from '@/data/repositories/event.repo';
import { MetricsRepo } from '@/data/repositories/metrics.repo';
import { isProcessed, markProcessed } from '@/core/queue/idempotency';
import { logger } from '@/lib/logger';
import type { AgentEvent } from '@/types/event';
import type { AgentDecision } from '@/types/agent';

export class Orchestrator {
  private registry: AgentRegistry;
  private contextBuilder: ContextBuilder;
  private budgetGuard: BudgetGuard;
  private rateLimiter: RateLimiter;
  private agentRunRepo: AgentRunRepo;
  private eventRepo: EventRepo;
  private metricsRepo: MetricsRepo;
  private billingGuard: BillingGuard;

  constructor() {
    this.registry = new AgentRegistry();
    this.contextBuilder = new ContextBuilder();
    this.budgetGuard = new BudgetGuard();
    this.rateLimiter = new RateLimiter();
    this.agentRunRepo = new AgentRunRepo();
    this.eventRepo = new EventRepo();
    this.metricsRepo = new MetricsRepo();
    this.billingGuard = new BillingGuard();
  }

  async processEvent(event: AgentEvent): Promise<void> {
    const startTime = Date.now();

    // 1. Idempotency
    if (await isProcessed(`agent:${event.id}`)) {
      logger.debug('Event already processed by agents', {
        eventId: event.id,
      });
      return;
    }
    // ─── BILLING CHECK ───
  const billingCheck = await this.billingGuard.canProcessEvent(event.storeId);
  if (!billingCheck.allowed) {
    logger.warn('Event blocked by billing', {
      storeId: event.storeId,
      reason: billingCheck.reason,
    });
    await markProcessed(`agent:${event.id}`);
    return;
  }

    try {
      // 2. Build context
      const context = await this.contextBuilder.build(event);

      // 3. Get eligible agents sorted by priority
      const agents = this.registry
        .getAgentsForEvent(event.type)
        .filter((a) => a.isEnabled(context));

      if (agents.length === 0) {
        logger.debug('No agents eligible for event', {
          eventId: event.id,
          type: event.type,
        });
        await markProcessed(`agent:${event.id}`);
        return;
      }

      // 4. Execute each eligible agent
      for (const agent of agents) {
        const agentStartTime = Date.now();

        try {
          // Budget check
          const canSpend = await this.budgetGuard.canSpend(
            event.storeId,
            agent.type
          );

          if (!canSpend) {
            logger.warn('Budget exceeded, skipping agent', {
              storeId: event.storeId,
              agentType: agent.type,
            });

            await this.agentRunRepo.create({
              storeId: event.storeId,
              agentType: agent.type,
              triggerEventId: event.id,
              context: {},
              decision: null,
              result: null,
              durationMs: Date.now() - agentStartTime,
              llmTokensUsed: 0,
              costUsd: 0,
              status: 'skipped',
              errorMessage: 'Budget exceeded',
            });

            continue;
          }

          // Rate limit check
          const canAct = await this.rateLimiter.canAct(
            event.storeId,
            agent.type
          );

          if (!canAct) {
            logger.debug('Rate limited, skipping agent', {
              storeId: event.storeId,
              agentType: agent.type,
            });
            continue;
          }

          // Agent decides
          if (!agent.canHandle(context)) {
            continue;
          }

          const decision = await agent.decide(context);
          const agentDecideTime = Date.now();

          if (decision.action === 'NO_ACTION') {
            await this.agentRunRepo.create({
              storeId: event.storeId,
              agentType: agent.type,
              triggerEventId: event.id,
              context: { eventType: event.type },
              decision,
              result: null,
              durationMs: agentDecideTime - agentStartTime,
              llmTokensUsed: decision.tokensUsed ?? 0,
              costUsd: decision.costUsd ?? 0,
              status: 'success',
            });
            continue;
          }

          // Agent executes
          const result = await agent.execute(decision, context);
          const agentEndTime = Date.now();

          // Log the run
          await this.agentRunRepo.create({
            storeId: event.storeId,
            agentType: agent.type,
            triggerEventId: event.id,
            context: { eventType: event.type },
            decision,
            result,
            durationMs: agentEndTime - agentStartTime,
            llmTokensUsed: decision.tokensUsed ?? 0,
            costUsd: decision.costUsd ?? 0,
            status: 'success',
          });

          // Track metrics
          await this.metricsRepo.incrementAgentActions(
            event.storeId,
            decision.costUsd ?? 0
          );

          logger.info('Agent action executed', {
            storeId: event.storeId,
            agentType: agent.type,
            action: decision.action,
            confidence: decision.confidence,
            durationMs: agentEndTime - agentStartTime,
          });
        } catch (agentError) {
          const agentEndTime = Date.now();

          logger.error('Agent execution error', {
            storeId: event.storeId,
            agentType: agent.type,
            eventId: event.id,
            error: agentError,
          });
          

          await this.agentRunRepo.create({
            storeId: event.storeId,
            agentType: agent.type,
            triggerEventId: event.id,
            context: { eventType: event.type },
            decision: null,
            result: null,
            durationMs: agentEndTime - agentStartTime,
            llmTokensUsed: 0,
            costUsd: 0,
            status: 'error',
            errorMessage:
              agentError instanceof Error
                ? agentError.message
                : 'Unknown error',
          });
        }
      }

      // 5. Mark event as processed
      await this.eventRepo.markProcessed(event.id);
      await markProcessed(`agent:${event.id}`);

      const totalDuration = Date.now() - startTime;
      logger.info('Event processing complete', {
        eventId: event.id,
        type: event.type,
        storeId: event.storeId,
        agentsRun: agents.length,
        totalDurationMs: totalDuration,
      });
    } catch (error) {
      logger.error('Orchestrator error', {
        eventId: event.id,
        error,
      });
      throw error;
    }
  }
}
