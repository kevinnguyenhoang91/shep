import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SupervisorConfigForm } from '@/components/supervisor/supervisor-config-form';
import { SupervisorAutonomy, SupervisorScopeType } from '@/domain/generated/output';
import type { SupervisorPolicy } from '@/domain/generated/output';

describe('SupervisorConfigForm', () => {
  it('renders the autonomy selector with the default advisory level', () => {
    render(
      <SupervisorConfigForm
        scopeType="app"
        scopeId="app-1"
        initialPolicy={null}
        onSubmitOverride={vi.fn().mockResolvedValue({ ok: true })}
      />
    );

    expect(screen.getByTestId('supervisor-config-form')).toBeInTheDocument();
    expect(screen.getByTestId('autonomy-trigger')).toHaveTextContent(/Advisory/i);
  });

  it('hydrates fields from an existing policy', () => {
    const policy: SupervisorPolicy = {
      id: 'pol-1',
      scopeType: SupervisorScopeType.app,
      scopeId: 'app-1',
      enabled: true,
      autonomyLevel: SupervisorAutonomy.cosign,
      modelId: 'claude-sonnet-4',
      promptVersion: 'v2',
      gateAuthorityJson: JSON.stringify({ merge: SupervisorAutonomy.autonomous }),
      policyRulesJson: undefined,
      notificationOverridesJson: undefined,
      createdAt: '2026-04-01T00:00:00Z',
      updatedAt: '2026-04-15T00:00:00Z',
    };

    render(
      <SupervisorConfigForm
        scopeType="app"
        scopeId="app-1"
        initialPolicy={policy}
        onSubmitOverride={vi.fn().mockResolvedValue({ ok: true })}
      />
    );

    expect(screen.getByTestId('autonomy-trigger')).toHaveTextContent(/Co-sign/i);
    expect(screen.getByTestId('model-id-input')).toHaveValue('claude-sonnet-4');
    expect(screen.getByTestId('prompt-version-input')).toHaveValue('v2');
    expect(screen.getByTestId('gate-trigger-merge')).toHaveTextContent(/Autonomous/i);
  });

  it('invokes the submit handler with the form values', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true });
    const user = userEvent.setup();

    render(
      <SupervisorConfigForm
        scopeType="app"
        scopeId="app-1"
        featureId="feat-99"
        initialPolicy={null}
        onSubmitOverride={onSubmit}
      />
    );

    await user.type(screen.getByTestId('model-id-input'), 'claude-haiku');
    await user.click(screen.getByTestId('submit'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledOnce();
    });
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        scopeType: 'app',
        scopeId: 'app-1',
        featureId: 'feat-99',
        autonomyLevel: SupervisorAutonomy.advisory,
        modelId: 'claude-haiku',
      })
    );
  });

  it('renders inline error on submit failure', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({ ok: false, error: 'Invalid' });

    render(
      <SupervisorConfigForm
        scopeType="app"
        scopeId="app-1"
        initialPolicy={null}
        onSubmitOverride={onSubmit}
      />
    );

    await user.click(screen.getByTestId('submit'));

    expect(await screen.findByTestId('form-error')).toHaveTextContent('Invalid');
  });

  it('shows loading state when forceState is loading', () => {
    render(
      <SupervisorConfigForm
        scopeType="app"
        scopeId="app-1"
        initialPolicy={null}
        forceState="loading"
        onSubmitOverride={vi.fn()}
      />
    );

    const form = screen.getByTestId('supervisor-config-form');
    expect(form).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('submit')).toBeDisabled();
  });
});
