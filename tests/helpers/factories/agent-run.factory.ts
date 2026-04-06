/**
 * AgentRun Test Factory
 *
 * Builds AgentRun entities with sensible defaults for unit tests.
 * Override any field via the `overrides` parameter.
 */

import { randomUUID } from 'node:crypto';
import type { AgentRun } from '@/domain/generated/output.js';
import { AgentRunStatus, AgentType } from '@/domain/generated/output.js';

/**
 * Build an AgentRun entity with sensible defaults.
 *
 * @param overrides - Partial AgentRun fields to override defaults
 * @returns A complete AgentRun object
 */
export function buildAgentRun(overrides?: Partial<AgentRun>): AgentRun {
  const id = overrides?.id ?? randomUUID();
  const now = new Date();

  return {
    id,
    agentType: AgentType.ClaudeCode,
    agentName: 'analyze-repository',
    status: AgentRunStatus.running,
    prompt: 'Analyze this repository',
    threadId: overrides?.threadId ?? randomUUID(),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
