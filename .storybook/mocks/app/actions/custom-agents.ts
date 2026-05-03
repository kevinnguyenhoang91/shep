/**
 * Storybook mock for /app/actions/custom-agents.
 */

interface CreateCustomAgentInput {
  agentType: string;
  name: string;
  description: string;
  initialPromptId?: string;
  initialPromptBody?: string;
}

interface CreateCustomAgentResult {
  ok: boolean;
  agentType?: string;
  error?: string;
}

interface DeleteCustomAgentResult {
  ok: boolean;
  error?: string;
}

export async function createCustomAgent(
  input: CreateCustomAgentInput
): Promise<CreateCustomAgentResult> {
  return { ok: true, agentType: input.agentType };
}

export async function deleteCustomAgent(_input: {
  agentType: string;
}): Promise<DeleteCustomAgentResult> {
  return { ok: true };
}
