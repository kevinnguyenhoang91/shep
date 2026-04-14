import { resolve } from '@/lib/server-container';
import type { ListFeaturesUseCase } from '@shepai/core/application/use-cases/features/list-features.use-case';
import type { ListRepositoriesUseCase } from '@shepai/core/application/use-cases/repositories/list-repositories.use-case';
import type { ListPluginsUseCase } from '@shepai/core/application/use-cases/plugins/list-plugins.use-case';
import { getSettings } from '@shepai/core/infrastructure/services/settings.service';
import { getWorkflowDefaults } from '@/app/actions/get-workflow-defaults';
import { getViewerPermission } from '@/app/actions/get-viewer-permission';
import { CreateDrawerClient } from '@/components/common/control-center-drawer/create-drawer-client';

/** Skip static pre-rendering since we need runtime DI container. */
export const dynamic = 'force-dynamic';

interface CreateDrawerPageProps {
  searchParams: Promise<{ repo?: string; parent?: string; prompt?: string }>;
}

export default async function CreateDrawerPage({ searchParams }: CreateDrawerPageProps) {
  const { repo, parent, prompt } = await searchParams;

  const listFeatures = resolve<ListFeaturesUseCase>('ListFeaturesUseCase');
  const listRepos = resolve<ListRepositoriesUseCase>('ListRepositoriesUseCase');
  const listPlugins = resolve<ListPluginsUseCase>('ListPluginsUseCase');
  const settings = getSettings();

  const [features, repositories, workflowDefaults, viewerPerm, plugins] = await Promise.all([
    listFeatures.execute(),
    listRepos.execute().catch(() => []),
    getWorkflowDefaults().catch(() => undefined),
    repo
      ? getViewerPermission(repo).catch(() => ({ canPushDirectly: false }))
      : Promise.resolve({ canPushDirectly: false }),
    listPlugins.execute().catch(() => []),
  ]);

  const featureOptions = features
    .map((f) => ({ id: f.id, name: f.name }))
    .filter((f) => f.id && !f.id.startsWith('#'));

  const repositoryOptions = repositories.map((r) => ({
    id: r.id,
    name: r.name,
    path: r.path,
  }));

  const installedPlugins = plugins.map((p) => ({
    name: p.name,
    displayName: p.displayName ?? p.name,
    enabled: p.enabled,
  }));

  return (
    <CreateDrawerClient
      repositoryPath={repo ?? ''}
      initialParentId={parent}
      initialDescription={prompt}
      features={featureOptions}
      repositories={repositoryOptions}
      workflowDefaults={workflowDefaults}
      currentAgentType={settings.agent.type}
      currentModel={settings.models.default}
      canPushDirectly={viewerPerm.canPushDirectly}
      installedPlugins={installedPlugins}
    />
  );
}
