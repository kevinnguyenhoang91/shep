import { notFound } from 'next/navigation';
import { resolve } from '@/lib/server-container';
import type { GetSupervisorPolicyUseCase } from '@shepai/core/application/use-cases/agents/get-supervisor-policy.use-case';
import { getFeatureFlags } from '@/lib/feature-flags';
import { SupervisorConfigForm } from '@/components/supervisor/supervisor-config-form';

/** Skip static pre-rendering — the page resolves a runtime DI container. */
export const dynamic = 'force-dynamic';

interface RouteProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ feature?: string }>;
}

export default async function SupervisorRoute({ params, searchParams }: RouteProps) {
  const flags = getFeatureFlags();
  if (!flags.collaboration) {
    notFound();
  }

  const { id } = await params;
  const { feature } = await searchParams;
  const featureId = feature?.trim() ? feature : undefined;

  const useCase = resolve<GetSupervisorPolicyUseCase>('GetSupervisorPolicyUseCase');
  const policy = await useCase.execute({ scopeType: 'app', scopeId: id, featureId });

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Supervisor</h1>
        <p className="text-muted-foreground text-sm">
          Configure a delegated guardian agent for this scope
          {featureId ? ' (feature override)' : ''}.
        </p>
      </header>
      <SupervisorConfigForm
        scopeType="app"
        scopeId={id}
        featureId={featureId}
        initialPolicy={policy}
      />
    </div>
  );
}
