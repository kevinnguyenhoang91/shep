import { notFound } from 'next/navigation';
import { resolve } from '@/lib/server-container';
import type { GetSupervisorPolicyUseCase } from '@shepai/core/application/use-cases/agents/get-supervisor-policy.use-case';
import type { IRepositoryRepository } from '@shepai/core/application/ports/output/repositories/repository-repository.interface';
import { getFeatureFlags } from '@/lib/feature-flags';
import { SupervisorConfigForm } from '@/components/supervisor/supervisor-config-form';

/** Skip static pre-rendering — the page resolves a runtime DI container. */
export const dynamic = 'force-dynamic';

interface RouteProps {
  params: Promise<{ repositoryId: string }>;
  searchParams: Promise<{ feature?: string }>;
}

export default async function RepositorySupervisorRoute({ params, searchParams }: RouteProps) {
  const flags = getFeatureFlags();
  if (!flags.collaboration) {
    notFound();
  }

  const { repositoryId } = await params;
  const { feature } = await searchParams;
  const featureId = feature?.trim() ? feature : undefined;

  const repoRepository = resolve<IRepositoryRepository>('IRepositoryRepository');
  const repo = await repoRepository.findById(repositoryId);
  if (!repo) {
    notFound();
  }

  const useCase = resolve<GetSupervisorPolicyUseCase>('GetSupervisorPolicyUseCase');
  const policy = await useCase.execute({ scopeType: 'repo', scopeId: repositoryId, featureId });

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Supervisor — {repo.name}</h1>
        <p className="text-muted-foreground text-sm">
          Configure a delegated guardian agent for this repository
          {featureId ? ' (feature override)' : ''}.
        </p>
      </header>
      <SupervisorConfigForm
        scopeType="repo"
        scopeId={repositoryId}
        featureId={featureId}
        initialPolicy={policy}
      />
    </div>
  );
}
