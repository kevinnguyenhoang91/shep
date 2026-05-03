import type { Meta, StoryObj } from '@storybook/react';
import { SupervisorDashboard } from './supervisor-dashboard';
import {
  SupervisorAutonomy,
  SupervisorScopeType,
  SupervisorVerdict,
} from '@shepai/core/domain/generated/output';
import type { SupervisorPolicy } from '@shepai/core/domain/generated/output';
import type { SupervisorDecisionStreamEvent } from '@shepai/core/application/use-cases/agents/stream-agent-events.use-case';

const meta: Meta<typeof SupervisorDashboard> = {
  title: 'Supervisor/SupervisorDashboard',
  component: SupervisorDashboard,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-5xl">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SupervisorDashboard>;

function policy(overrides: Partial<SupervisorPolicy>): SupervisorPolicy {
  const now = new Date().toISOString();
  return {
    id: overrides.id ?? `pol-${Math.random().toString(36).slice(2, 8)}`,
    scopeType: overrides.scopeType ?? SupervisorScopeType.global,
    enabled: overrides.enabled ?? true,
    autonomyLevel: overrides.autonomyLevel ?? SupervisorAutonomy.advisory,
    createdAt: now as unknown as Date,
    updatedAt: now as unknown as Date,
    ...overrides,
  } as SupervisorPolicy;
}

function decision(
  overrides: Partial<SupervisorDecisionStreamEvent>
): SupervisorDecisionStreamEvent {
  return {
    kind: 'supervisor_decision',
    decisionId: overrides.decisionId ?? `dec-${Math.random().toString(36).slice(2, 8)}`,
    scopeType: overrides.scopeType ?? SupervisorScopeType.app,
    scopeId: overrides.scopeId ?? 'app-1',
    supervisorRunId: overrides.supervisorRunId ?? 'sup-run-1',
    sourceEventKind: overrides.sourceEventKind ?? 'gate',
    sourceEventId: overrides.sourceEventId ?? 'gate-1',
    verdict: overrides.verdict ?? SupervisorVerdict.advise,
    rationale: overrides.rationale ?? 'Looks safe to merge — no schema changes.',
    modelId: overrides.modelId ?? 'claude-sonnet-4',
    promptVersion: overrides.promptVersion ?? 'v1',
    createdAt: overrides.createdAt ?? new Date().toISOString(),
  };
}

export const Empty: Story = {
  args: { policies: [], recentDecisions: [] },
};

export const Mixed: Story = {
  args: {
    policies: [
      policy({ scopeType: SupervisorScopeType.global, autonomyLevel: SupervisorAutonomy.advisory }),
      policy({
        scopeType: SupervisorScopeType.app,
        scopeId: 'app-1',
        autonomyLevel: SupervisorAutonomy.cosign,
        modelId: 'claude-sonnet-4',
      }),
      policy({
        scopeType: SupervisorScopeType.repo,
        scopeId: 'repo-1',
        autonomyLevel: SupervisorAutonomy.advisory,
      }),
      policy({
        scopeType: SupervisorScopeType.repo,
        scopeId: 'repo-1',
        featureId: 'feat-9',
        autonomyLevel: SupervisorAutonomy.autonomous,
      }),
    ],
    recentDecisions: [
      decision({ verdict: SupervisorVerdict.advise, rationale: 'PR looks fine' }),
      decision({
        verdict: SupervisorVerdict.escalate,
        rationale: 'Migration touches user data — flagging for review',
      }),
      decision({ verdict: SupervisorVerdict.approve, rationale: 'Auto-approved' }),
    ],
    names: {
      app: { 'app-1': 'Internal SaaS' },
      repo: { 'repo-1': 'cli' },
      feature: { 'feat-9': 'DevRel-Optimized GitHub Release Notes' },
    },
  },
};

export const Many: Story = {
  args: {
    policies: Array.from({ length: 12 }, (_, i) =>
      policy({
        id: `pol-${i}`,
        scopeType:
          i % 4 === 0
            ? SupervisorScopeType.global
            : i % 4 === 1
              ? SupervisorScopeType.app
              : SupervisorScopeType.repo,
        scopeId: i % 4 === 0 ? undefined : `scope-${i}`,
      })
    ),
    recentDecisions: Array.from({ length: 8 }, (_, i) =>
      decision({
        decisionId: `dec-${i}`,
        verdict:
          i % 3 === 0
            ? SupervisorVerdict.approve
            : i % 3 === 1
              ? SupervisorVerdict.advise
              : SupervisorVerdict.escalate,
        rationale: `Decision ${i + 1}: rationale text`,
      })
    ),
  },
};
