'use client';

import { useState, useEffect } from 'react';
import { X, MessageCircleQuestion, ShieldCheck, ArrowRight, Plus } from 'lucide-react';
import Link from 'next/link';
import type { Route } from 'next';
import { cn } from '@/lib/utils';

const DISMISSED_KEY = 'shep:collaboration-onboarding-dismissed';

export interface AppEntry {
  id: string;
  name: string;
}

export interface CollaborationOnboardingProps {
  /** Applications available on the canvas — used to build the supervisor picker. */
  apps?: AppEntry[];
  className?: string;
}

/**
 * Dismissable first-run callout shown in the control center when the
 * collaboration feature flag is on. Guides the user step-by-step:
 *
 *   0 apps  → tells them to create one first, links to control center create prompt
 *   1 app   → links directly to /application/[id]/supervisor
 *   N apps  → shows an inline app picker (up to 3 pills + overflow count)
 *
 * Dismissal is persisted in localStorage so it only shows once per browser profile.
 */
export function CollaborationOnboarding({ apps = [], className }: CollaborationOnboardingProps) {
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
        <SupervisorCard apps={apps} />
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

// ── Supervisor card — three states depending on how many apps exist ──────────

function SupervisorCard({ apps }: { apps: AppEntry[] }) {
  const [pickerOpen, setPickerOpen] = useState(false);

  if (apps.length === 0) {
    return (
      <div className="bg-muted/40 border-border/40 flex flex-col gap-2 rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 text-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
            <ShieldCheck className="size-3.5" />
          </div>
          <span className="text-sm font-medium">Supervisor agent</span>
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Supervisors are configured per application. Create your first application to get started.
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

  if (apps.length === 1) {
    return (
      <FeatureCard
        icon={ShieldCheck}
        title="Supervisor agent"
        description="Delegate approvals and policy decisions to an AI guardian that acts on your behalf."
        href={`/application/${apps[0].id}/supervisor` as Route}
        cta="Configure supervisor"
      />
    );
  }

  // Multiple apps — inline picker
  const visible = apps.slice(0, 3);
  const overflow = apps.length - visible.length;

  return (
    <div className="bg-muted/40 border-border/40 flex flex-col gap-2 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <div className="bg-primary/10 text-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
          <ShieldCheck className="size-3.5" />
        </div>
        <span className="text-sm font-medium">Supervisor agent</span>
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed">
        Pick an application to configure its supervisor.
      </p>

      {pickerOpen ? (
        <div className="mt-1 flex flex-col gap-1">
          {apps.map((app) => (
            <Link
              key={app.id}
              href={`/application/${app.id}/supervisor` as Route}
              className="border-border/50 hover:bg-background flex items-center justify-between rounded-md border px-3 py-2 text-xs transition-colors"
            >
              <span className="truncate font-medium">{app.name}</span>
              <ArrowRight className="text-muted-foreground ml-2 size-3 shrink-0" />
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {visible.map((app) => (
            <Link
              key={app.id}
              href={`/application/${app.id}/supervisor` as Route}
              className="border-border/50 bg-background hover:border-primary/40 hover:text-primary flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors"
            >
              {app.name}
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
