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
 * Spec 093 — agent message stream scoped to an (appId, featureId?) pair.
 * Returns the cumulative list and the most recent envelope so consumers can
 * either render history or react to the latest delta.
 */
export interface AgentMessageScope {
  appId: string;
  featureId?: string;
}

export function useAgentMessages(scope: AgentMessageScope): {
  messages: AgentMessageStreamEvent[];
  last: AgentMessageStreamEvent | null;
} {
  const ctx = useContext(AgentEventsContext);
  if (!ctx) return { messages: [], last: null };
  const messages = ctx.agentMessages.filter((m) => matchesScope(m.appId, m.featureId, scope));
  const last =
    ctx.lastAgentMessage &&
    matchesScope(ctx.lastAgentMessage.appId, ctx.lastAgentMessage.featureId, scope)
      ? ctx.lastAgentMessage
      : null;
  return { messages, last };
}

/**
 * Spec 093 — agent question stream scoped by app/feature.
 */
export function useAgentQuestions(scope: AgentMessageScope): {
  questions: AgentQuestionStreamEvent[];
  last: AgentQuestionStreamEvent | null;
} {
  const ctx = useContext(AgentEventsContext);
  if (!ctx) return { questions: [], last: null };
  const questions = ctx.agentQuestions.filter((q) => matchesScope(q.appId, q.featureId, scope));
  const last =
    ctx.lastAgentQuestion &&
    matchesScope(ctx.lastAgentQuestion.appId, ctx.lastAgentQuestion.featureId, scope)
      ? ctx.lastAgentQuestion
      : null;
  return { questions, last };
}

/**
 * Spec 093 — supervisor decision stream scoped by app/feature.
 */
export function useSupervisorDecisions(scope: AgentMessageScope): {
  decisions: SupervisorDecisionStreamEvent[];
  last: SupervisorDecisionStreamEvent | null;
} {
  const ctx = useContext(AgentEventsContext);
  if (!ctx) return { decisions: [], last: null };
  const decisions = ctx.supervisorDecisions.filter((d) =>
    matchesScope(d.appId, d.featureId, scope)
  );
  const last =
    ctx.lastSupervisorDecision &&
    matchesScope(ctx.lastSupervisorDecision.appId, ctx.lastSupervisorDecision.featureId, scope)
      ? ctx.lastSupervisorDecision
      : null;
  return { decisions, last };
}

function matchesScope(
  appId: string,
  featureId: string | undefined,
  scope: AgentMessageScope
): boolean {
  if (appId !== scope.appId) return false;
  if (scope.featureId !== undefined && featureId !== scope.featureId) return false;
  return true;
}
