'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import type { SupervisorDecisionStreamEvent } from '@shepai/core/application/use-cases/agents/stream-agent-events.use-case';
import { SupervisorVerdict } from '@shepai/core/domain/generated/output';

const VERDICT_VARIANT: Record<SupervisorVerdict, 'default' | 'destructive' | 'secondary'> = {
  [SupervisorVerdict.approve]: 'default',
  [SupervisorVerdict.reject]: 'destructive',
  [SupervisorVerdict.escalate]: 'secondary',
  [SupervisorVerdict.advise]: 'secondary',
};

export interface SupervisorDecisionWhyDrawerProps {
  /** All decisions for the gate or question this drawer documents. */
  decisions: SupervisorDecisionStreamEvent[];
  /** Optional override for the trigger button text. */
  triggerLabel?: string;
  /** Storybook escape hatch — render the drawer expanded by default. */
  defaultOpen?: boolean;
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function SupervisorDecisionWhyDrawer({
  decisions,
  triggerLabel = 'Why?',
  defaultOpen = false,
}: SupervisorDecisionWhyDrawerProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (decisions.length === 0) return null;

  // Decisions are ordered newest-first when supplied by the SSE stream; render
  // chronological so the audit trail reads top-to-bottom.
  const ordered = [...decisions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const latest = ordered[ordered.length - 1];

  return (
    <Drawer open={open} onOpenChange={setOpen} direction="right">
      <DrawerTrigger asChild>
        <Button type="button" variant="ghost" size="sm" data-testid="supervisor-why-trigger">
          {triggerLabel}
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-w-md" data-testid="supervisor-why-drawer" direction="right">
        <DrawerHeader>
          <DrawerTitle>Supervisor decision</DrawerTitle>
          <DrawerDescription>
            {ordered.length === 1
              ? 'Why the supervisor reached this verdict.'
              : `Audit trail for ${ordered.length} decisions.`}
          </DrawerDescription>
        </DrawerHeader>
        <div
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6"
          data-testid="supervisor-why-content"
        >
          {ordered.map((decision) => (
            <article
              key={decision.decisionId}
              className="flex flex-col gap-2 rounded border p-3"
              data-testid={`decision-row-${decision.decisionId}`}
            >
              <header className="flex items-center justify-between gap-2">
                <Badge
                  variant={VERDICT_VARIANT[decision.verdict] ?? 'secondary'}
                  data-testid={`decision-verdict-${decision.decisionId}`}
                  className="capitalize"
                >
                  {decision.verdict}
                </Badge>
                <time className="text-muted-foreground text-xs">
                  {formatTimestamp(decision.createdAt)}
                </time>
              </header>
              <p
                className="text-sm whitespace-pre-wrap"
                data-testid={`decision-rationale-${decision.decisionId}`}
              >
                {decision.rationale}
              </p>
              <dl className="text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <dt>Model</dt>
                <dd data-testid={`decision-model-${decision.decisionId}`}>{decision.modelId}</dd>
                <dt>Prompt version</dt>
                <dd data-testid={`decision-prompt-${decision.decisionId}`}>
                  {decision.promptVersion}
                </dd>
                {decision.ruleRef ? (
                  <>
                    <dt>Rule</dt>
                    <dd data-testid={`decision-rule-${decision.decisionId}`}>{decision.ruleRef}</dd>
                  </>
                ) : null}
                {typeof decision.confidence === 'number' ? (
                  <>
                    <dt>Confidence</dt>
                    <dd data-testid={`decision-confidence-${decision.decisionId}`}>
                      {Math.round(decision.confidence * 100)}%
                    </dd>
                  </>
                ) : null}
                <dt>Source</dt>
                <dd>
                  {decision.sourceEventKind} · {decision.sourceEventId}
                </dd>
              </dl>
            </article>
          ))}
        </div>
        <div className="text-muted-foreground border-t p-4 text-xs">
          Latest verdict: <span className="font-medium">{latest.verdict}</span>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
