/**
 * Storybook mock for /app/actions/agent-graph.
 *
 * Server actions can't be bundled by the Storybook Vite build, so the
 * preview swaps in this no-op stub via the alias map in `.storybook/main.ts`.
 */

interface SaveAgentGraphInput {
  agentType: string;
  nodes: { id: string; label: string; description?: string }[];
  edges: { from: string; to: string; label?: string }[];
}

interface ResetAgentGraphInput {
  agentType: string;
}

interface SaveAgentGraphResult {
  ok: boolean;
  error?: string;
}

export async function saveAgentGraph(_input: SaveAgentGraphInput): Promise<SaveAgentGraphResult> {
  return { ok: true };
}

export async function resetAgentGraph(_input: ResetAgentGraphInput): Promise<SaveAgentGraphResult> {
  return { ok: true };
}
