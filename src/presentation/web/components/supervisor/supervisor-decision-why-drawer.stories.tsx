import type { Meta, StoryObj } from '@storybook/react';
import { SupervisorDecisionWhyDrawer } from './supervisor-decision-why-drawer';
import { SupervisorVerdict } from '@shepai/core/domain/generated/output';
import type { SupervisorDecisionStreamEvent } from '@shepai/core/application/use-cases/agents/stream-agent-events.use-case';

const meta: Meta<typeof SupervisorDecisionWhyDrawer> = {
  title: 'Supervisor/SupervisorDecisionWhyDrawer',
  component: SupervisorDecisionWhyDrawer,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof SupervisorDecisionWhyDrawer>;

function decision(
  overrides: Partial<SupervisorDecisionStreamEvent> = {}
): SupervisorDecisionStreamEvent {
  return {
    kind: 'supervisor_decision',
    decisionId: 'dec-1',
    scopeType: 'app',
    scopeId: 'app-1',
    featureId: 'feat-1',
    supervisorRunId: 'sup-1',
    sourceEventKind: 'gate',
    sourceEventId: 'run-1',
    verdict: SupervisorVerdict.advise,
    rationale: 'Tests pass and no migrations affect production data.',
    modelId: 'claude-sonnet-4',
    promptVersion: 'v1',
    createdAt: '2026-04-29T10:00:00Z',
    ...overrides,
  };
}

export const Default: Story = {
  args: {
    decisions: [decision()],
    defaultOpen: true,
  },
};

export const LongRationale: Story = {
  args: {
    decisions: [
      decision({
        rationale:
          'Supervisor noted that the diff touches three migration files and one production-route handler.\n' +
          'CI is green and a snapshot of the prior schema is available.\n' +
          'Recommendation: proceed with merge but watch the post-deploy error rate for 30 minutes.',
      }),
    ],
    defaultOpen: true,
  },
};

export const WithRuleRef: Story = {
  args: {
    decisions: [
      decision({
        verdict: SupervisorVerdict.approve,
        rationale: 'Auto-approved per coverage rule (≥ 85% on touched files).',
        ruleRef: 'coverage-threshold',
        confidence: 0.92,
      }),
    ],
    defaultOpen: true,
  },
};

export const AuditTrail: Story = {
  args: {
    decisions: [
      decision({
        decisionId: 'dec-1',
        verdict: SupervisorVerdict.advise,
        rationale: 'Initial review — needs human inspection.',
        createdAt: '2026-04-29T10:00:00Z',
      }),
      decision({
        decisionId: 'dec-2',
        verdict: SupervisorVerdict.escalate,
        rationale: 'User declined; escalating to a peer reviewer.',
        createdAt: '2026-04-29T11:00:00Z',
      }),
      decision({
        decisionId: 'dec-3',
        verdict: SupervisorVerdict.approve,
        rationale: 'Peer-reviewed and accepted.',
        createdAt: '2026-04-29T12:00:00Z',
        confidence: 0.78,
      }),
    ],
    defaultOpen: true,
  },
};
