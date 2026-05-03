/**
 * Storybook mock for /app/actions/agent-prompts.
 *
 * Server actions can't be bundled by the Storybook Vite build, so the
 * preview swaps in this no-op stub via the alias map in `.storybook/main.ts`.
 */

interface SaveAgentPromptInput {
  agentType: string;
  promptId: string;
  body: string;
}

interface ResetAgentPromptInput {
  agentType: string;
  promptId: string;
}

interface SaveAgentPromptResult {
  ok: boolean;
  error?: string;
}

export async function saveAgentPrompt(
  _input: SaveAgentPromptInput
): Promise<SaveAgentPromptResult> {
  return { ok: true };
}

export async function resetAgentPrompt(
  _input: ResetAgentPromptInput
): Promise<SaveAgentPromptResult> {
  return { ok: true };
}
