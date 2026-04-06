'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgentAvailabilityStatus } from '@/hooks/use-agent-availability';

export interface AgentAvailabilityBadgeProps {
  status: AgentAvailabilityStatus;
  className?: string;
}

const STATUS_CONFIG: Record<AgentAvailabilityStatus, { dotClass: string; label: string }> = {
  available: {
    dotClass: 'bg-emerald-500',
    label: 'Ready',
  },
  'needs-auth': {
    dotClass: 'bg-amber-500',
    label: 'Needs auth',
  },
  'not-installed': {
    dotClass: 'bg-muted-foreground/40',
    label: 'Not installed',
  },
  checking: {
    dotClass: '',
    label: 'Checking',
  },
};

export function AgentAvailabilityBadge({ status, className }: AgentAvailabilityBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)} title={config.label}>
      {status === 'checking' ? (
        <Loader2 className="text-muted-foreground h-2.5 w-2.5 animate-spin" />
      ) : (
        <span
          className={cn('inline-block h-2 w-2 shrink-0 rounded-full', config.dotClass)}
          aria-hidden="true"
        />
      )}
      <span className="text-muted-foreground text-[10px] leading-none">{config.label}</span>
    </span>
  );
}
