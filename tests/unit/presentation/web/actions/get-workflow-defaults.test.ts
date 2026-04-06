// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSettingsReader = {
  getSettings: vi.fn(),
  hasSettings: vi.fn().mockReturnValue(true),
};

vi.mock('@/lib/server-container', () => ({
  resolve: (token: string) => {
    if (token === 'ISettingsReader') return mockSettingsReader;
    throw new Error(`Unknown token: ${token}`);
  },
}));

const { getWorkflowDefaults } = await import(
  '../../../../../src/presentation/web/app/actions/get-workflow-defaults.js'
);

describe('getWorkflowDefaults server action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps workflow settings to drawer defaults', async () => {
    mockSettingsReader.getSettings.mockReturnValue({
      workflow: {
        openPrOnImplementationComplete: true,
        approvalGateDefaults: {
          allowPrd: true,
          allowPlan: false,
          allowMerge: true,
          pushOnImplementationComplete: true,
        },
        ciWatchEnabled: true,
        enableEvidence: true,
        commitEvidence: true,
        defaultFastMode: true,
        skillInjection: { enabled: true, skills: [] },
      },
    });

    const result = await getWorkflowDefaults();

    expect(result).toEqual({
      approvalGates: {
        allowPrd: true,
        allowPlan: false,
        allowMerge: true,
      },
      push: true,
      openPr: true,
      ciWatchEnabled: true,
      enableEvidence: true,
      commitEvidence: true,
      fast: true,
      injectSkills: true,
    });
  });

  it('returns all false when workflow defaults are all false', async () => {
    mockSettingsReader.getSettings.mockReturnValue({
      workflow: {
        openPrOnImplementationComplete: false,
        approvalGateDefaults: {
          allowPrd: false,
          allowPlan: false,
          allowMerge: false,
          pushOnImplementationComplete: false,
        },
        ciWatchEnabled: false,
        enableEvidence: false,
        commitEvidence: false,
        defaultFastMode: false,
        skillInjection: { enabled: false, skills: [] },
      },
    });

    const result = await getWorkflowDefaults();

    expect(result).toEqual({
      approvalGates: {
        allowPrd: false,
        allowPlan: false,
        allowMerge: false,
      },
      push: false,
      openPr: false,
      ciWatchEnabled: false,
      enableEvidence: false,
      commitEvidence: false,
      fast: false,
      injectSkills: false,
    });
  });

  it('maps pushOnImplementationComplete to push field', async () => {
    mockSettingsReader.getSettings.mockReturnValue({
      workflow: {
        openPrOnImplementationComplete: false,
        approvalGateDefaults: {
          allowPrd: false,
          allowPlan: false,
          allowMerge: false,
          pushOnImplementationComplete: true,
        },
        ciWatchEnabled: false,
        enableEvidence: false,
        commitEvidence: false,
        defaultFastMode: false,
      },
    });

    const result = await getWorkflowDefaults();

    expect(result.push).toBe(true);
    expect(result.openPr).toBe(false);
  });

  it('maps openPrOnImplementationComplete to openPr field', async () => {
    mockSettingsReader.getSettings.mockReturnValue({
      workflow: {
        openPrOnImplementationComplete: true,
        approvalGateDefaults: {
          allowPrd: false,
          allowPlan: false,
          allowMerge: false,
          pushOnImplementationComplete: false,
        },
        ciWatchEnabled: false,
        enableEvidence: false,
        commitEvidence: false,
        defaultFastMode: false,
      },
    });

    const result = await getWorkflowDefaults();

    expect(result.push).toBe(false);
    expect(result.openPr).toBe(true);
  });
});
