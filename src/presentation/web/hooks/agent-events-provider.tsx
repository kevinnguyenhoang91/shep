'use client';

import { createContext, useContext, type ReactNode } from 'react';
import {
  NotificationEventType,
  type ApplicationUpdatePayload,
  type OperationLogAppendPayload,
} from '@shepai/core/domain/generated/output';
import type {
  AgentMessageStreamEvent,
  AgentQuestionStreamEvent,
  SupervisorDecisionStreamEvent,
} from '@shepai/core/application/use-cases/agents/stream-agent-events.use-case';
import {
  useAgentEvents,
  type UseAgentEventsOptions,
  type UseAgentEventsResult,
} from './use-agent-events';

export const AgentEventsContext = createContext<UseAgentEventsResult | null>(null);

interface AgentEventsProviderProps extends UseAgentEventsOptions {
  children: ReactNode;
}

/**
 * Single SSE connection for agent events shared across all consumers.
 * Wrap the app once; use `useAgentEventsContext()` to read.
 */
export function AgentEventsProvider({ children, runId }: AgentEventsProviderProps) {
  const result = useAgentEvents({ runId });
  return <AgentEventsContext.Provider value={result}>{children}</AgentEventsContext.Provider>;
}

export function useAgentEventsContext(): UseAgentEventsResult {
  const ctx = useContext(AgentEventsContext);
  if (!ctx) {
    throw new Error('useAgentEventsContext must be used within an <AgentEventsProvider>');
  }
  return ctx;
}

/**
 * Like {@link useAgentEventsContext} but returns `null` instead of throwing
 * when no provider is mounted — use this from components that also need to
 * render in isolated contexts (Storybook, unit tests) where the global
 * SSE provider is not available.
 */
export function useOptionalAgentEventsContext(): UseAgentEventsResult | null {
  return useContext(AgentEventsContext);
}

/**
 * Latest `ApplicationUpdated` event scoped to one `applicationId`, or `null`.
 * Returns the payload (not the full `NotificationEvent`) because callers
 * only need the patchable fields.
 */
export function useApplicationUpdate(applicationId: string): ApplicationUpdatePayload | null {
  const ctx = useContext(AgentEventsContext);
  const last = ctx?.lastEvent;
  if (!last) return null;
  if (last.eventType !== NotificationEventType.ApplicationUpdated) return null;
  const payload = last.applicationUpdate;
  if (!payload) return null;
  if (payload.applicationId !== applicationId) return null;
  return payload;
}

/**
 * Latest `OperationLogAppended` entry scoped to one `applicationId`, or
 * `null`. Entries are scoped by `entry.operationId === applicationId`.
 */
export function useOperationLogAppend(
  applicationId: string
): OperationLogAppendPayload['entry'] | null {
  const ctx = useContext(AgentEventsContext);
  const last = ctx?.lastEvent;
  if (!last) return null;
  if (last.eventType !== NotificationEventType.OperationLogAppended) return null;
  const entry = last.operationLogAppend?.entry;
  if (!entry) return null;
  if (entry.operationId !== applicationId) return null;
  return entry;
}

/**
 * Spec 093 — agent message stream scoped to a (scopeType, scopeId?, featureId?) tuple.
 * Returns the cumulative list and the most recent envelope so consumers can
 * either render history or react to the latest delta.
 */
export interface AgentMessageScope {
  scopeType: string;
  scopeId?: string;
  featureId?: string;
}

export function useAgentMessages(scope: AgentMessageScope): {
  messages: AgentMessageStreamEvent[];
  last: AgentMessageStreamEvent | null;
} {
  const ctx = useContext(AgentEventsContext);
  if (!ctx) return { messages: [], last: null };
  const messages = ctx.agentMessages.filter((m) => matchesMessageScope(m, scope));
  const last =
    ctx.lastAgentMessage && matchesMessageScope(ctx.lastAgentMessage, scope)
      ? ctx.lastAgentMessage
      : null;
  return { messages, last };
}

/**
 * Spec 093 — agent question stream scoped by scope type/id/feature.
 */
export function useAgentQuestions(scope: AgentMessageScope): {
  questions: AgentQuestionStreamEvent[];
  last: AgentQuestionStreamEvent | null;
} {
  const ctx = useContext(AgentEventsContext);
  if (!ctx) return { questions: [], last: null };
  const questions = ctx.agentQuestions.filter((q) => matchesMessageScope(q, scope));
  const last =
    ctx.lastAgentQuestion && matchesMessageScope(ctx.lastAgentQuestion, scope)
      ? ctx.lastAgentQuestion
      : null;
  return { questions, last };
}

/**
 * Spec 093 — supervisor decision stream scoped by scope type/id/feature.
 */
export function useSupervisorDecisions(scope: AgentMessageScope): {
  decisions: SupervisorDecisionStreamEvent[];
  last: SupervisorDecisionStreamEvent | null;
} {
  const ctx = useContext(AgentEventsContext);
  if (!ctx) return { decisions: [], last: null };
  const decisions = ctx.supervisorDecisions.filter((d) => matchesDecisionScope(d, scope));
  const last =
    ctx.lastSupervisorDecision && matchesDecisionScope(ctx.lastSupervisorDecision, scope)
      ? ctx.lastSupervisorDecision
      : null;
  return { decisions, last };
}

function matchesMessageScope(
  event: { appId?: string; repositoryId?: string; featureId?: string },
  scope: AgentMessageScope
): boolean {
  if (scope.scopeType === 'app' && scope.scopeId && event.appId !== scope.scopeId) return false;
  if (scope.scopeType === 'repo' && scope.scopeId && event.repositoryId !== scope.scopeId)
    return false;
  if (scope.featureId !== undefined && event.featureId !== scope.featureId) return false;
  return true;
}

function matchesDecisionScope(
  event: { scopeType: string; scopeId?: string; featureId?: string },
  scope: AgentMessageScope
): boolean {
  if (scope.scopeType !== event.scopeType) return false;
  if (scope.scopeId && event.scopeId !== scope.scopeId) return false;
  if (scope.featureId !== undefined && event.featureId !== scope.featureId) return false;
  return true;
}
