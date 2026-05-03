'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  X,
  MessageCircleQuestion,
  ShieldCheck,
  ArrowRight,
  Plus,
  Layers,
  GitBranch,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import type { Route } from 'next';
import { cn } from '@/lib/utils';

const DISMISSED_KEY = 'shep:collaboration-onboarding-dismissed';

/** Human-friendly cap for the inline pill list before collapsing into a picker. */
const PILL_LIMIT = 3;

export type SupervisorScopeKind = 'app' | 'repo' | 'feature';

export interface SupervisorScopeEntry {
  id: string;
  name: string;
  kind: SupervisorScopeKind;
}

export interface CollaborationOnboardingProps {
  /** Applications on the canvas. */
  apps?: SupervisorScopeEntry[];
  /** Repositories on the canvas. */
  repos?: SupervisorScopeEntry[];
  /** Features on the canvas. */
  features?: SupervisorScopeEntry[];
  className?: string;
}

/**
 * Dismissable first-run callout shown in the control center when the
 * collaboration feature flag is on. Surfaces every entity the user can
 * attach a supervisor to — applications, repositories, and features —
 * mirroring the cascading scope model (`global → app → repo → feature`).
 *
 *   no scopes  → tells the user to add a repo or app to get started
 *   1 scope    → links directly to the right /supervisor/... page
 *   N scopes   → shows up to PILL_LIMIT inline pills with an overflow picker
 */
export function CollaborationOnboarding({
  apps = [],
  repos = [],
  features = [],
  className,
}: CollaborationOnboardingProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(DISMISSED_KEY)) {
        setVisible(true);
      }
    } catch {
      // localStorage blocked (private mode, SSR, etc.)
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // ignore
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className={cn(
        'border-border/60 bg-card relative flex flex-col gap-4 rounded-xl border p-5 shadow-sm',
        className
      )}
      role="region"
      aria-label="Agent collaboration onboarding"
      data-testid="collaboration-onboarding"
    >
      {/* Dismiss */}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismiss}
        className="text-muted-foreground hover:text-foreground absolute top-3 right-3 rounded-md p-1 transition-colors"
      >
        <X className="size-4" />
      </button>

      {/* Header */}
      <div>
        <p className="text-[10px] font-semibold tracking-widest text-indigo-500 uppercase">New</p>
        <h2 className="mt-0.5 text-base font-semibold">Agent Collaboration &amp; Supervision</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Your agents can now ask questions, talk to each other, and be guided by a supervisor you
          configure.
        </p>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SupervisorCard apps={apps} repos={repos} features={features} />
        <FeatureCard
          icon={MessageCircleQuestion}
          title="Agent questions inbox"
          description="A single place for all questions raised by agents during interactive and background runs."
          href="/agent-questions"
          cta="View inbox"
        />
      </div>
    </div>
  );
}

// ── Supervisor card — adapts to whatever scopes exist on the canvas ──────────

interface SupervisorCardProps {
  apps: SupervisorScopeEntry[];
  repos: SupervisorScopeEntry[];
  features: SupervisorScopeEntry[];
}

function SupervisorCard({ apps, repos, features }: SupervisorCardProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const allScopes = useMemo(
    () => [
      ...apps.map((a) => ({ ...a, kind: 'app' as const })),
      ...repos.map((r) => ({ ...r, kind: 'repo' as const })),
      ...features.map((f) => ({ ...f, kind: 'feature' as const })),
    ],
    [apps, repos, features]
  );

  // Empty: no apps, repos, or features yet.
  if (allScopes.length === 0) {
    return (
      <div className="bg-muted/40 border-border/40 flex flex-col gap-2 rounded-lg border p-4">
        <SupervisorHeader />
        <p className="text-muted-foreground text-xs leading-relaxed">
          Supervisors attach to an application, repository, or feature. Add a repository or create
          an application to configure your first one.
        </p>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('shep:open-create-application'))}
          className="text-primary mt-auto inline-flex cursor-pointer items-center gap-1 text-xs font-medium hover:underline"
        >
          <Plus className="size-3" />
          Create an application
        </button>
      </div>
    );
  }

  // Single scope on the canvas — link straight to its page.
  if (allScopes.length === 1) {
    const only = allScopes[0]!;
    return (
      <FeatureCard
        icon={ShieldCheck}
        title="Supervisor agent"
        description={`Delegate approvals and policy decisions for ${describeKind(only.kind)} "${only.name}".`}
        href={routeFor(only)}
        cta="Configure supervisor"
      />
    );
  }

  // Multiple — show a few pills + (open picker for the rest).
  const pills = allScopes.slice(0, PILL_LIMIT);
  const overflow = allScopes.length - pills.length;

  return (
    <div className="bg-muted/40 border-border/40 flex flex-col gap-2 rounded-lg border p-4">
      <SupervisorHeader />
      <p className="text-muted-foreground text-xs leading-relaxed">
        Pick an application, repository, or feature to configure its supervisor.
      </p>

      {pickerOpen ? (
        <div className="mt-1 flex max-h-72 flex-col gap-1 overflow-y-auto">
          {allScopes.map((scope) => (
            <Link
              key={`${scope.kind}-${scope.id}`}
              href={routeFor(scope)}
              className="border-border/50 hover:bg-background flex items-center justify-between rounded-md border px-3 py-2 text-xs transition-colors"
            >
              <span className="flex min-w-0 items-center gap-2">
                <KindIcon kind={scope.kind} className="text-muted-foreground size-3 shrink-0" />
                <span className="truncate font-medium">{scope.name}</span>
              </span>
              <ArrowRight className="text-muted-foreground ml-2 size-3 shrink-0" />
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {pills.map((scope) => (
            <Link
              key={`${scope.kind}-${scope.id}`}
              href={routeFor(scope)}
              className="border-border/50 bg-background hover:border-primary/40 hover:text-primary flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors"
            >
              <KindIcon kind={scope.kind} className="size-3 shrink-0" />
              <span className="max-w-[10rem] truncate">{scope.name}</span>
              <ArrowRight className="size-2.5" />
            </Link>
          ))}
          {overflow > 0 ? (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="text-muted-foreground hover:text-foreground border-border/50 rounded-md border px-2.5 py-1 text-xs transition-colors"
            >
              +{overflow} more
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function SupervisorHeader() {
  return (
    <div className="flex items-center gap-2">
      <div className="bg-primary/10 text-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
        <ShieldCheck className="size-3.5" />
      </div>
      <span className="text-sm font-medium">Supervisor agent</span>
    </div>
  );
}

function KindIcon({ kind, className }: { kind: SupervisorScopeKind; className?: string }) {
  const Icon = kind === 'app' ? Layers : kind === 'repo' ? GitBranch : Sparkles;
  return <Icon className={className} aria-hidden />;
}

function describeKind(kind: SupervisorScopeKind): string {
  return kind === 'app' ? 'application' : kind === 'repo' ? 'repository' : 'feature';
}

function routeFor(scope: SupervisorScopeEntry): Route {
  switch (scope.kind) {
    case 'app':
      return `/application/${scope.id}/supervisor` as Route;
    case 'repo':
      return `/supervisor/repo/${scope.id}` as Route;
    case 'feature':
      return `/supervisor/feature/${scope.id}` as Route;
  }
}

// ── Generic card ─────────────────────────────────────────────────────────────

interface FeatureCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  href: Route;
  cta: string;
}

function FeatureCard({ icon: Icon, title, description, href, cta }: FeatureCardProps) {
  return (
    <div className="bg-muted/40 border-border/40 flex flex-col gap-2 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <div className="bg-primary/10 text-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
          <Icon className="size-3.5" />
        </div>
        <span className="text-sm font-medium">{title}</span>
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed">{description}</p>
      <Link
        href={href}
        className="text-primary mt-auto inline-flex items-center gap-1 text-xs font-medium hover:underline"
      >
        {cta}
        <ArrowRight className="size-3" />
      </Link>
    </div>
  );
}
