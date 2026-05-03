import { notFound } from 'next/navigation';
import { resolve } from '@/lib/server-container';
import type { GetSupervisorPolicyUseCase } from '@shepai/core/application/use-cases/agents/get-supervisor-policy.use-case';
import type { IFeatureRepository } from '@shepai/core/application/ports/output/repositories/feature-repository.interface';
import { getFeatureFlags } from '@/lib/feature-flags';
import { SupervisorConfigForm } from '@/components/supervisor/supervisor-config-form';

/** Skip static pre-rendering — the page resolves a runtime DI container. */
export const dynamic = 'force-dynamic';

interface RouteProps {
  params: Promise<{ featureId: string }>;
}

/**
 * Per-feature supervisor override. The override is anchored to the feature's
 * parent repository scope when one exists, falling back to the global scope
 * (`scopeType=global`, no `scopeId`) for orphan features. The cascade
 * resolver still walks `feature → repo → app → global` when evaluating which
 * policy actually applies at runtime.
 */
export default async function FeatureSupervisorRoute({ params }: RouteProps) {
  const flags = getFeatureFlags();
  if (!flags.collaboration) {
    notFound();
  }

  const { featureId } = await params;

  const featureRepo = resolve<IFeatureRepository>('IFeatureRepository');
  const feature = await featureRepo.findById(featureId);
  if (!feature) {
    notFound();
  }

  const scopeType = feature.repositoryId ? 'repo' : 'global';
  const scopeId = feature.repositoryId;

  const useCase = resolve<GetSupervisorPolicyUseCase>('GetSupervisorPolicyUseCase');
  const policy = await useCase.execute({ scopeType, scopeId, featureId });

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Supervisor — {feature.name}</h1>
        <p className="text-muted-foreground text-sm">
          Per-feature override. Falls back to the {scopeType === 'repo' ? 'repository' : 'global'}{' '}
          policy when unset.
        </p>
      </header>
      <SupervisorConfigForm
        scopeType={scopeType}
        scopeId={scopeId}
        featureId={featureId}
        initialPolicy={policy}
      />
    </div>
  );
}
