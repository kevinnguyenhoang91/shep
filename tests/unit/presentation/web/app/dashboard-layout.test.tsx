import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FleetOverview, FleetTriageItem } from '@shepai/core/domain/generated/output';
import { FleetTriageCategory, FleetTriagePriority } from '@shepai/core/domain/generated/output';

const mockGetGraphData = vi.fn();
const mockGetFleetData = vi.fn();

vi.mock('@/app/(dashboard)/get-graph-data', () => ({
  getGraphData: () => mockGetGraphData(),
}));

vi.mock('@/app/actions/fleet-data', () => ({
  getFleetData: () => mockGetFleetData(),
}));

vi.mock('@/components/features/control-center', () => ({
  ControlCenter: ({ drawer }: { drawer?: React.ReactNode }) => (
    <div data-testid="control-center-mock">
      <span>Canvas Content</span>
      {drawer}
    </div>
  ),
}));

vi.mock('@/components/features/session-tree', () => ({
  SessionTreePanel: () => <div data-testid="session-tree-mock">Session Tree</div>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/control-center',
}));

import DashboardLayout from '@/app/(dashboard)/layout';

const NOW = '2026-09-23T00:00:00.000Z';

const OVERVIEW: FleetOverview = {
  counts: {
    total: 52,
    cruising: 42,
    queued: 5,
    attentionNeeded: 3,
    failed: 2,
    waitingApproval: 3,
    blockedQuestions: 0,
  },
  circuitBreakerTripped: false,
  activeTriageCount: 3,
  consecutiveFailures: 0,
  timestamp: NOW,
};

const ITEMS: FleetTriageItem[] = [
  {
    featureId: 'feat-1',
    featureName: 'Plan Approval Gate',
    slug: 'plan-gate',
    priority: FleetTriagePriority.p1,
    category: FleetTriageCategory.gate,
    reason: 'Waiting on plan approval gate',
    runId: 'run-1',
    gateType: 'plan',
    createdAt: NOW,
  },
];

describe('DashboardLayout (Control Center)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGraphData.mockResolvedValue({
      nodes: [],
      edges: [],
      deployments: [],
    });
    mockGetFleetData.mockResolvedValue({
      overview: OVERVIEW,
      triageItems: ITEMS,
    });
  });

  it('renders FleetControl inside the header chrome above the canvas', async () => {
    const jsx = await DashboardLayout({
      children: <div data-testid="page-child">Child Content</div>,
      drawer: null,
    });

    render(jsx);

    const header = screen.getByRole('banner');
    expect(header).toBeInTheDocument();

    const fleetBar = screen.getByTestId('fleet-status-bar');
    expect(header).toContainElement(fleetBar);

    // Canvas container is rendered outside and after the header in document order
    const canvas = screen.getByTestId('control-center-mock');
    expect(header).not.toContainElement(canvas);
    expect(header.compareDocumentPosition(canvas)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('displays fleet counts and allows opening triage drawer from header', async () => {
    const jsx = await DashboardLayout({
      children: null,
      drawer: null,
    });

    render(jsx);

    expect(screen.getByTestId('fleet-count-cruising')).toHaveTextContent('42cruising');
    expect(screen.getByTestId('fleet-count-attention')).toHaveTextContent('3need you');

    const triageButton = screen.getByTestId('fleet-open-triage');
    expect(triageButton).toHaveTextContent('Triage (3)');

    fireEvent.click(triageButton);
    expect(screen.getByTestId('fleet-triage-drawer')).toBeInTheDocument();
    expect(screen.getByText('Plan Approval Gate')).toBeInTheDocument();
  });

  it('handles server fleet data failure gracefully without breaking dashboard rendering', async () => {
    mockGetFleetData.mockRejectedValue(new Error('Fleet DB connection refused'));

    const jsx = await DashboardLayout({
      children: <div data-testid="page-child">Child Content</div>,
      drawer: null,
    });

    render(jsx);

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByTestId('control-center-mock')).toBeInTheDocument();
    expect(screen.getByTestId('page-child')).toBeInTheDocument();
  });
});
