import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SupervisorDecisionWhyDrawer } from '@/components/supervisor/supervisor-decision-why-drawer';
import { SupervisorVerdict } from '@/domain/generated/output';
import type { SupervisorDecisionStreamEvent } from '@shepai/core/application/use-cases/agents/stream-agent-events.use-case';

function decision(
  overrides: Partial<SupervisorDecisionStreamEvent> = {}
): SupervisorDecisionStreamEvent {
  return {
    kind: 'supervisor_decision',
    decisionId: 'dec-1',
    scopeType: 'app',
    scopeId: 'app-1',
    supervisorRunId: 'sup-1',
    sourceEventKind: 'gate',
    sourceEventId: 'run-1',
    verdict: SupervisorVerdict.advise,
    rationale: 'looks fine',
    modelId: 'claude-sonnet-4',
    promptVersion: 'v1',
    createdAt: '2026-04-29T10:00:00Z',
    ...overrides,
  };
}

describe('SupervisorDecisionWhyDrawer', () => {
  it('renders nothing when no decisions are supplied', () => {
    const { container } = render(<SupervisorDecisionWhyDrawer decisions={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('exposes a trigger button when decisions exist', () => {
    render(<SupervisorDecisionWhyDrawer decisions={[decision()]} />);
    expect(screen.getByTestId('supervisor-why-trigger')).toBeInTheDocument();
  });

  it('renders rationale, verdict, model, and prompt version when open', () => {
    render(
      <SupervisorDecisionWhyDrawer
        decisions={[
          decision({
            decisionId: 'dec-x',
            verdict: SupervisorVerdict.approve,
            rationale: 'auto-approved',
            modelId: 'claude-haiku',
            promptVersion: 'v3',
          }),
        ]}
        defaultOpen
      />
    );

    expect(screen.getByTestId('decision-verdict-dec-x')).toHaveTextContent('approve');
    expect(screen.getByTestId('decision-rationale-dec-x')).toHaveTextContent('auto-approved');
    expect(screen.getByTestId('decision-model-dec-x')).toHaveTextContent('claude-haiku');
    expect(screen.getByTestId('decision-prompt-dec-x')).toHaveTextContent('v3');
  });

  it('shows confidence and ruleRef when present', () => {
    render(
      <SupervisorDecisionWhyDrawer
        decisions={[
          decision({
            decisionId: 'dec-y',
            confidence: 0.88,
            ruleRef: 'coverage-rule',
          }),
        ]}
        defaultOpen
      />
    );

    expect(screen.getByTestId('decision-confidence-dec-y')).toHaveTextContent('88%');
    expect(screen.getByTestId('decision-rule-dec-y')).toHaveTextContent('coverage-rule');
  });

  it('renders a row per decision in chronological order', () => {
    render(
      <SupervisorDecisionWhyDrawer
        decisions={[
          decision({
            decisionId: 'dec-2',
            createdAt: '2026-04-29T11:00:00Z',
            rationale: 'second',
          }),
          decision({
            decisionId: 'dec-1',
            createdAt: '2026-04-29T10:00:00Z',
            rationale: 'first',
          }),
        ]}
        defaultOpen
      />
    );

    const rows = screen.getAllByText(/first|second/);
    expect(rows[0]).toHaveTextContent('first');
    expect(rows[rows.length - 1]).toHaveTextContent('second');
  });
});
