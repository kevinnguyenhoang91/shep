'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { checkAgentAuthForType } from '@/app/actions/check-agent-auth-for-type';
import type { AgentAuthForTypeStatus } from '@/app/actions/check-agent-auth-for-type';

export type AgentAvailabilityStatus = 'available' | 'needs-auth' | 'not-installed' | 'checking';

export interface AgentAvailability {
  status: AgentAvailabilityStatus;
  loading: boolean;
}

function deriveStatus(result: AgentAuthForTypeStatus): AgentAvailabilityStatus {
  if (result.installed && result.authenticated) return 'available';
  if (result.installed && !result.authenticated) return 'needs-auth';
  return 'not-installed';
}

/** How often to re-check availability (ms). */
const REFRESH_INTERVAL_MS = 60_000;

/**
 * Checks agent availability for a list of agent types.
 * Returns a map from agentType to { status, loading }.
 *
 * Results are cached and refreshed on the given interval.
 */
export function useAgentAvailability(agentTypes: string[]): Record<string, AgentAvailability> {
  const [results, setResults] = useState<Record<string, AgentAvailability>>(() => {
    const initial: Record<string, AgentAvailability> = {};
    for (const at of agentTypes) {
      initial[at] = { status: 'checking', loading: true };
    }
    return initial;
  });

  // Keep a stable ref of the agent types to avoid re-triggering effects on every render
  const agentTypesKey = agentTypes.join(',');
  const mountedRef = useRef(true);

  const fetchAll = useCallback(async () => {
    const types = agentTypesKey.split(',').filter(Boolean);
    if (types.length === 0) return;

    const promises = types.map(async (agentType) => {
      try {
        const result = await checkAgentAuthForType(agentType);
        return { agentType, status: deriveStatus(result), loading: false } as const;
      } catch {
        return { agentType, status: 'not-installed' as const, loading: false };
      }
    });

    const settled = await Promise.all(promises);
    if (!mountedRef.current) return;

    setResults((prev) => {
      const next = { ...prev };
      for (const entry of settled) {
        next[entry.agentType] = { status: entry.status, loading: entry.loading };
      }
      return next;
    });
  }, [agentTypesKey]);

  // Reset to checking when agent types change
  useEffect(() => {
    const types = agentTypesKey.split(',').filter(Boolean);
    setResults((prev) => {
      const next: Record<string, AgentAvailability> = {};
      for (const at of types) {
        next[at] = prev[at] ?? { status: 'checking', loading: true };
      }
      return next;
    });
  }, [agentTypesKey]);

  useEffect(() => {
    mountedRef.current = true;
    fetchAll();
    const interval = setInterval(fetchAll, REFRESH_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchAll]);

  return results;
}
