import { notFound } from 'next/navigation';
import { resolve } from '@/lib/server-container';
import type { ListSupervisorPoliciesUseCase } from '@shepai/core/application/use-cases/agents/list-supervisor-policies.use-case';
import type { ListRecentSupervisorDecisionsUseCase } from '@shepai/core/application/use-cases/agents/list-recent-supervisor-decisions.use-case';
import type { IRepositoryRepository } from '@shepai/core/application/ports/output/repositories/repository-repository.interface';
import type { IApplicationRepository } from '@shepai/core/application/ports/output/repositories/application-repository.interface';
import type { IFeatureRepository } from '@shepai/core/application/ports/output/repositories/feature-repository.interface';
import type { SupervisorDecisionStreamEvent } from '@shepai/core/application/use-cases/agents/stream-agent-events.use-case';
import type { SupervisorDecision, SupervisorVerdict } from '@shepai/core/domain/generated/output';
import { getFeatureFlags } from '@/lib/feature-flags';
import {
  SupervisorDashboard,
  type ScopeNameLookup,
} from '@/components/supervisor/supervisor-dashboard';
import { CreateSupervisorDialog } from '@/components/supervisor/create-supervisor-dialog';
import { WelcomeBanner } from '@/components/onboarding/welcome-banner';

/** Skip static pre-rendering — runtime DI container required. */
export const dynamic = 'force-dynamic';

export default async function SupervisorRoute() {
  const flags = getFeatureFlags();
  if (!flags.collaboration) {
    notFound();
  }

  const listPolicies = resolve<ListSupervisorPoliciesUseCase>('ListSupervisorPoliciesUseCase');
  const listRecent = resolve<ListRecentSupervisorDecisionsUseCase>(
    'ListRecentSupervisorDecisionsUseCase'
  );

  const [{ policies }, recentDecisionsRaw] = await Promise.all([
    listPolicies.execute(),
    listRecent.execute({ limit: 20 }),
  ]);

  const recentDecisions = recentDecisionsRaw.map(toStreamShape);

  const names = await resolveScopeNames(policies);
  const scopeOptions = await loadScopeOptions();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-6">
      <WelcomeBanner
        id="supervisor:v1"
        title="New here? Read the 2-minute supervisor walkthrough."
        description="Supervisors watch agents and decide what to approve, advise, escalate, or reject. Policies cascade from feature to repo to application to global."
        ctaLabel="Open the tutorial"
        ctaHref="/onboarding#supervisors"
      />
      <div className="flex items-center justify-end">
        <CreateSupervisorDialog
          applications={scopeOptions.applications}
          repositories={scopeOptions.repositories}
          features={scopeOptions.features}
        />
      </div>
      <SupervisorDashboard policies={policies} recentDecisions={recentDecisions} names={names} />
    </div>
  );
}

interface ScopeOptionsLoaded {
  applications: { id: string; name: string }[];
  repositories: { id: string; name: string }[];
  features: { id: string; name: string; applicationId?: string; repositoryId?: string }[];
}

async function loadScopeOptions(): Promise<ScopeOptionsLoaded> {
  const apps = await safeListApplications();
  const repos = await safeListRepositories();
  const features = await safeListFeatures();
  return {
    applications: apps.map((a) => ({ id: a.id, name: a.name })),
    repositories: repos.map((r) => ({ id: r.id, name: r.name })),
    features: features.map((f) => ({
      id: f.id,
      name: f.name,
      ...(f.applicationId !== undefined && { applicationId: f.applicationId }),
      ...(f.repositoryId !== undefined && { repositoryId: f.repositoryId }),
    })),
  };
}

async function safeListApplications(): Promise<{ id: string; name: string }[]> {
  try {
    const repo = resolve<IApplicationRepository>('IApplicationRepository');
    return (await repo.list()).map((a) => ({ id: a.id, name: a.name }));
  } catch {
    return [];
  }
}

async function safeListRepositories(): Promise<{ id: string; name: string }[]> {
  try {
    const repo = resolve<IRepositoryRepository>('IRepositoryRepository');
    return (await repo.list()).map((r) => ({ id: r.id, name: r.name }));
  } catch {
    return [];
  }
}

async function safeListFeatures(): Promise<
  { id: string; name: string; applicationId?: string; repositoryId?: string }[]
> {
  try {
    const repo = resolve<IFeatureRepository>('IFeatureRepository');
    const all = await repo.list();
    return all.map((f) => ({
      id: f.id,
      name: f.name,
      ...(f.applicationId !== undefined && f.applicationId !== null
        ? { applicationId: f.applicationId }
        : {}),
      ...(f.repositoryId !== undefined && f.repositoryId !== null
        ? { repositoryId: f.repositoryId }
        : {}),
    }));
  } catch {
    return [];
  }
}

function toStreamShape(decision: SupervisorDecision): SupervisorDecisionStreamEvent {
  return {
    kind: 'supervisor_decision',
    decisionId: decision.id,
    scopeType: decision.scopeType,
    ...(decision.scopeId !== undefined && { scopeId: decision.scopeId }),
    ...(decision.featureId !== undefined && { featureId: decision.featureId }),
    supervisorRunId: decision.supervisorRunId,
    sourceEventKind: decision.sourceEventKind,
    sourceEventId: decision.sourceEventId,
    verdict: decision.verdict as SupervisorVerdict,
    rationale: decision.rationale,
    modelId: decision.modelId,
    promptVersion: decision.promptVersion,
    ...(decision.ruleRef !== undefined && { ruleRef: decision.ruleRef }),
    ...(decision.confidence !== undefined && { confidence: decision.confidence }),
    createdAt:
      decision.createdAt instanceof Date
        ? decision.createdAt.toISOString()
        : new Date(decision.createdAt as unknown as string).toISOString(),
  };
}

async function resolveScopeNames(
  policies: { scopeType: string; scopeId?: string; featureId?: string }[]
): Promise<ScopeNameLookup> {
  const appIds = new Set<string>();
  const repoIds = new Set<string>();
  const featureIds = new Set<string>();
  for (const p of policies) {
    if (p.featureId) featureIds.add(p.featureId);
    if (!p.scopeId) continue;
    if (p.scopeType === 'app') appIds.add(p.scopeId);
    else if (p.scopeType === 'repo') repoIds.add(p.scopeId);
  }

  const names: ScopeNameLookup = { app: {}, repo: {}, feature: {} };

  await Promise.all([
    hydrateNames(
      appIds,
      (id) => resolve<IApplicationRepository>('IApplicationRepository').findById(id),
      names.app!
    ),
    hydrateNames(
      repoIds,
      (id) => resolve<IRepositoryRepository>('IRepositoryRepository').findById(id),
      names.repo!
    ),
    hydrateNames(
      featureIds,
      (id) => resolve<IFeatureRepository>('IFeatureRepository').findById(id),
      names.feature!
    ),
  ]);

  return names;
}

async function hydrateNames<T extends { name: string } | null>(
  ids: Set<string>,
  fetch: (id: string) => Promise<T>,
  out: Record<string, string>
): Promise<void> {
  await Promise.all(
    [...ids].map(async (id) => {
      try {
        const row = await fetch(id);
        if (row?.name) out[id] = row.name;
      } catch {
        // Best-effort lookup — fall back to the raw id in the dashboard row.
      }
    })
  );
}
