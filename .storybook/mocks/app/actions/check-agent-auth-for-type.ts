const defaults: Record<string, { installed: boolean; authenticated: boolean }> = {
  'claude-code': { installed: true, authenticated: true },
  'codex-cli': { installed: true, authenticated: true },
  cursor: { installed: true, authenticated: false },
  'gemini-cli': { installed: false, authenticated: false },
  'copilot-cli': { installed: true, authenticated: true },
  dev: { installed: true, authenticated: true },
};

/** Override in stories via `window.__mockAgentAuthForType` */
export async function checkAgentAuthForType(agentType: string) {
  const win = globalThis as Record<string, unknown>;
  if (win.__mockAgentAuthForType && typeof win.__mockAgentAuthForType === 'function') {
    return (win.__mockAgentAuthForType as (at: string) => unknown)(agentType);
  }
  const fallback = defaults[agentType] ?? { installed: true, authenticated: true };
  return { agentType, ...fallback };
}
