/**
 * AgentSession Test Factory
 *
 * Builds AgentSession entities with sensible defaults for unit tests.
 * Override any field via the `overrides` parameter.
 */

import { randomUUID } from 'node:crypto';
import type { AgentSession } from '@/domain/generated/output.js';
import { AgentType } from '@/domain/generated/output.js';

/**
 * Build an AgentSession entity with sensible defaults.
 *
 * @param overrides - Partial AgentSession fields to override defaults
 * @returns A complete AgentSession object
 */
export function buildAgentSession(overrides?: Partial<AgentSession>): AgentSession {
  const id = overrides?.id ?? randomUUID();
  const now = new Date();

  return {
    id,
    agentType: AgentType.ClaudeCode,
    projectPath: '~/repos/test-project',
    messageCount: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
