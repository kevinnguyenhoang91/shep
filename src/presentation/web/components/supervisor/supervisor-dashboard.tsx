'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { Globe2, Layers, GitBranch, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SupervisorDecisionWhyDrawer } from './supervisor-decision-why-drawer';
import { SupervisorVerdict } from '@shepai/core/domain/generated/output';
import type { SupervisorPolicy, SupervisorAutonomy } from '@shepai/core/domain/generated/output';
import type { SupervisorDecisionStreamEvent } from '@shepai/core/application/use-cases/agents/stream-agent-events.use-case';

const VERDICT_VARIANT: Record<SupervisorVerdict, 'default' | 'destructive' | 'secondary'> = {
  [SupervisorVerdict.approve]: 'default',
  [SupervisorVerdict.reject]: 'destructive',
  [SupervisorVerdict.escalate]: 'secondary',
  [SupervisorVerdict.advise]: 'secondary',
};

const AUTONOMY_LABEL: Record<SupervisorAutonomy, string> = {
  advisory: 'Advisory',
  cosign: 'Co-sign',
  autonomous: 'Autonomous',
};

/** Display name resolver for a scope row — keeps the dashboard offline-renderable. */
export interface ScopeNameLookup {
  app?: Record<string, string>;
  repo?: Record<string, string>;
  feature?: Record<string, string>;
}

export interface SupervisorDashboardProps {
  policies: SupervisorPolicy[];
  recentDecisions: SupervisorDecisionStreamEvent[];
  /** Optional id → display-name lookup so rows show "cli" instead of a UUID. */
  names?: ScopeNameLookup;
}

export function SupervisorDashboard({
  policies,
  recentDecisions,
  names = {},
}: SupervisorDashboardProps) {
  const grouped = groupByScope(policies);

  return (
    <div className="flex flex-col gap-8" data-testid="supervisor-dashboard">
      <header className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <ShieldCheck className="size-6" />
          Supervisor
        </h1>
        <p className="text-muted-foreground text-sm">
          Every configured supervisor policy and the most recent decisions across all scopes.
        </p>
      </header>

      <section className="flex flex-col gap-3" data-testid="supervisor-policies">
        <h2 className="text-sm font-semibold tracking-wide uppercase">
          Policies <span className="text-muted-foreground font-normal">({policies.length})</span>
        </h2>
        {policies.length === 0 ? (
          <EmptyPoliciesState />
        ) : (
          <div className="flex flex-col gap-4">
            <ScopeGroup
              kind="global"
              policies={grouped.global}
              names={names}
              data-testid="scope-group-global"
            />
            <ScopeGroup
              kind="app"
              policies={grouped.app}
              names={names}
              data-testid="scope-group-app"
            />
            <ScopeGroup
              kind="repo"
              policies={grouped.repo}
              names={names}
              data-testid="scope-group-repo"
            />
            <ScopeGroup
              kind="feature"
              policies={grouped.feature}
              names={names}
              data-testid="scope-group-feature"
            />
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3" data-testid="supervisor-recent-decisions">
        <h2 className="text-sm font-semibold tracking-wide uppercase">
          Recent decisions{' '}
          <span className="text-muted-foreground font-normal">({recentDecisions.length})</span>
        </h2>
        {recentDecisions.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
            No decisions yet — the supervisor hasn't been invoked or no policies are configured.
          </p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {recentDecisions.map((decision) => (
              <li
                key={decision.decisionId}
                className="flex items-start gap-3 px-3 py-2"
                data-testid={`recent-decision-${decision.decisionId}`}
              >
                <Badge
                  variant={VERDICT_VARIANT[decision.verdict] ?? 'secondary'}
                  className="mt-0.5 capitalize"
                >
                  {decision.verdict}
                </Badge>
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="line-clamp-1 text-sm">{decision.rationale}</p>
                  <p className="text-muted-foreground text-xs">
                    {describeScope(decision.scopeType, decision.scopeId, decision.featureId)} ·{' '}
                    {decision.sourceEventKind} · {formatRelative(decision.createdAt)}
                  </p>
                </div>
                <SupervisorDecisionWhyDrawer decisions={[decision]} triggerLabel="Why?" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────

interface GroupedPolicies {
  global: SupervisorPolicy[];
  app: SupervisorPolicy[];
  repo: SupervisorPolicy[];
  feature: SupervisorPolicy[];
}

function groupByScope(policies: SupervisorPolicy[]): GroupedPolicies {
  const grouped: GroupedPolicies = { global: [], app: [], repo: [], feature: [] };
  for (const p of policies) {
    if (p.featureId) grouped.feature.push(p);
    else if (p.scopeType === 'global') grouped.global.push(p);
    else if (p.scopeType === 'app') grouped.app.push(p);
    else if (p.scopeType === 'repo') grouped.repo.push(p);
  }
  return grouped;
}

interface ScopeGroupProps {
  kind: 'global' | 'app' | 'repo' | 'feature';
  policies: SupervisorPolicy[];
  names: ScopeNameLookup;
  'data-testid'?: string;
}

const SCOPE_LABEL: Record<ScopeGroupProps['kind'], string> = {
  global: 'Global',
  app: 'Applications',
  repo: 'Repositories',
  feature: 'Per-feature overrides',
};

function ScopeGroup({ kind, policies, names, ...rest }: ScopeGroupProps) {
  if (policies.length === 0) return null;

  return (
    <div className="flex flex-col gap-2" {...rest}>
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
        <KindIcon kind={kind} className="size-3" />
        {SCOPE_LABEL[kind]} ({policies.length})
      </p>
      <ul className="flex flex-col divide-y rounded-lg border">
        {policies.map((policy) => (
          <li
            key={policy.id}
            className="flex items-center gap-3 px-3 py-2"
            data-testid={`policy-row-${policy.id}`}
          >
            <KindIcon kind={kind} className="text-muted-foreground size-4 shrink-0" aria-hidden />
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="truncate text-sm font-medium">{describePolicyName(policy, names)}</p>
              <p className="text-muted-foreground text-xs">
                {AUTONOMY_LABEL[policy.autonomyLevel] ?? policy.autonomyLevel}
                {policy.modelId ? ` · ${policy.modelId}` : ''}
              </p>
            </div>
            <Badge variant={policy.enabled ? 'default' : 'secondary'} className="shrink-0">
              {policy.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
            <Link
              href={hrefForPolicy(policy)}
              className="text-primary inline-flex shrink-0 items-center gap-1 text-xs hover:underline"
              data-testid={`policy-link-${policy.id}`}
            >
              Configure
              <ArrowRight className="size-3" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptyPoliciesState() {
  return (
    <div className="bg-muted/30 flex flex-col items-start gap-3 rounded-lg border border-dashed p-6">
      <p className="text-sm font-medium">No supervisor policies configured</p>
      <p className="text-muted-foreground text-sm">
        Configure a supervisor at the global, application, repository, or feature level. The cascade
        picks the most specific match (feature &gt; repo &gt; app &gt; global) at run time.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={'/' as Route}
          className="border-border hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium"
          data-testid="empty-policies-cta-app"
        >
          <Layers className="size-3" />
          Pick an application
        </Link>
        <Link
          href={'/agents' as Route}
          className="border-border hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium"
          data-testid="empty-policies-cta-agents"
        >
          <ArrowRight className="size-3" />
          Edit agent prompts instead
        </Link>
      </div>
    </div>
  );
}

function KindIcon({
  kind,
  className,
  ...rest
}: {
  kind: ScopeGroupProps['kind'];
  className?: string;
  'aria-hidden'?: boolean;
}) {
  const Icon =
    kind === 'global' ? Globe2 : kind === 'app' ? Layers : kind === 'repo' ? GitBranch : Sparkles;
  return <Icon className={className} {...rest} />;
}

function describePolicyName(policy: SupervisorPolicy, names: ScopeNameLookup): string {
  if (policy.featureId) {
    const featureName = names.feature?.[policy.featureId] ?? policy.featureId;
    const parent = policy.scopeId
      ? (names[policy.scopeType === 'app' ? 'app' : 'repo']?.[policy.scopeId] ?? policy.scopeId)
      : 'global';
    return `${featureName} (under ${parent})`;
  }
  if (policy.scopeType === 'global') return 'Global default';
  const lookup = policy.scopeType === 'app' ? names.app : names.repo;
  return policy.scopeId ? (lookup?.[policy.scopeId] ?? policy.scopeId) : policy.scopeType;
}

function hrefForPolicy(policy: SupervisorPolicy): Route {
  if (policy.featureId) return `/supervisor/feature/${policy.featureId}` as Route;
  if (policy.scopeType === 'app' && policy.scopeId) {
    return `/application/${policy.scopeId}/supervisor` as Route;
  }
  if (policy.scopeType === 'repo' && policy.scopeId) {
    return `/supervisor/repo/${policy.scopeId}` as Route;
  }
  return `/supervisor` as Route;
}

function describeScope(scopeType: string, scopeId?: string, featureId?: string): string {
  if (featureId) return `feature:${featureId.slice(0, 8)}`;
  if (scopeType === 'global') return 'global';
  return scopeId ? `${scopeType}:${scopeId.slice(0, 8)}` : scopeType;
}

const RELATIVE_THRESHOLDS: { ms: number; label: (n: number) => string }[] = [
  { ms: 60_000, label: (n) => `${n}s ago` },
  { ms: 3_600_000, label: (n) => `${n}m ago` },
  { ms: 86_400_000, label: (n) => `${n}h ago` },
];

function formatRelative(iso: string): string {
  const elapsed = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(elapsed)) return iso;
  for (const { ms, label } of RELATIVE_THRESHOLDS) {
    if (elapsed < ms) {
      const divisor = ms === 60_000 ? 1_000 : ms === 3_600_000 ? 60_000 : 3_600_000;
      return label(Math.max(1, Math.floor(elapsed / divisor)));
    }
  }
  return new Date(iso).toLocaleDateString();
}
