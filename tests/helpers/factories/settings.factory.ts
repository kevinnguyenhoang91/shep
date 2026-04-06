/**
 * Settings Test Factory
 *
 * Builds Settings entities with sensible defaults for unit tests.
 * Override any field via the `overrides` parameter.
 */

import { randomUUID } from 'node:crypto';
import type { Settings } from '@/domain/generated/output.js';
import { AgentAuthMethod, AgentType, EditorType, TerminalType } from '@/domain/generated/output.js';

/**
 * Build a Settings entity with sensible defaults.
 *
 * Provides a complete, valid Settings object so tests only need to
 * override the fields they care about.
 *
 * @param overrides - Partial Settings fields to override defaults
 * @returns A complete Settings object
 */
export function buildSettings(overrides?: Partial<Settings>): Settings {
  const id = overrides?.id ?? randomUUID();
  const now = new Date();

  return {
    id,
    models: { default: 'claude-sonnet-4-20250514' },
    user: {},
    environment: {
      defaultEditor: EditorType.VsCode,
      shellPreference: 'bash',
      terminalPreference: TerminalType.System,
    },
    system: {
      autoUpdate: true,
      logLevel: 'info',
    },
    agent: {
      type: AgentType.ClaudeCode,
      authMethod: AgentAuthMethod.Session,
    },
    notifications: {
      inApp: { enabled: true },
      browser: { enabled: false },
      desktop: { enabled: false },
      events: {
        agentStarted: false,
        phaseCompleted: false,
        waitingApproval: true,
        agentCompleted: true,
        agentFailed: true,
        prMerged: true,
        prClosed: false,
        prChecksPassed: false,
        prChecksFailed: true,
        prBlocked: true,
        mergeReviewReady: true,
      },
    },
    workflow: {
      openPrOnImplementationComplete: false,
      approvalGateDefaults: {
        allowPrd: false,
        allowPlan: false,
        allowMerge: false,
        pushOnImplementationComplete: false,
      },
      ciWatchEnabled: true,
      enableEvidence: false,
      commitEvidence: false,
      defaultFastMode: true,
    },
    onboardingComplete: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
