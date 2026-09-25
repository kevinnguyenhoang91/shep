import type { ReactNode } from 'react';
import { ControlCenter } from '@/components/features/control-center';
import { FleetControl } from '@/components/fleet';
import { getFleetData } from '@/app/actions/fleet-data';
import { SessionTreePanel } from '@/components/features/session-tree';
import { DeploymentStatusProvider } from '@/hooks/deployment-status-provider';
import { SessionsProvider } from '@/hooks/sessions-provider';
import { getGraphData } from './get-graph-data';

/** Skip static pre-rendering since we need runtime DI container and server context. */
export const dynamic = 'force-dynamic';

interface DashboardLayoutProps {
  children: ReactNode;
  drawer: ReactNode;
}

/**
 * The Control Center shell: session-tree sub-nav beside the canvas and fleet status header.
 */
export default async function DashboardLayout({ children, drawer }: DashboardLayoutProps) {
  const [{ nodes, edges, deployments }, fleetData] = await Promise.all([
    getGraphData(),
    getFleetData().catch(() => undefined),
  ]);

  return (
    <div className="flex h-screen w-full">
      <DeploymentStatusProvider initialDeployments={deployments}>
        <SessionsProvider>
          <aside
            className="hidden h-full shrink-0 md:block"
            aria-label="Session tree"
            data-testid="session-tree-sidenav"
          >
            <SessionTreePanel />
          </aside>
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="bg-background/80 flex h-11 shrink-0 items-center justify-end border-b px-4 backdrop-blur">
              <FleetControl initialData={fleetData} />
            </header>
            <div className="relative min-w-0 flex-1">
              <ControlCenter initialNodes={nodes} initialEdges={edges} drawer={drawer} />
              {children}
            </div>
          </div>
        </SessionsProvider>
      </DeploymentStatusProvider>
    </div>
  );
}
