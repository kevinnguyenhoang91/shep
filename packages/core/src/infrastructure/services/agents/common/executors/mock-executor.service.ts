/**
 * Mock Agent Executor
 *
 * Deterministic executor for E2E tests. Returns predictable responses
 * so tests can assert on exact slugs, names, and descriptions.
 *
 * Activated via SHEP_MOCK_EXECUTOR=1 environment variable.
 */

import type { AgentType, AgentFeature } from '../../../../../domain/generated/output.js';
import type {
  IAgentExecutor,
  AgentExecutionOptions,
  AgentExecutionResult,
  AgentExecutionStreamEvent,
} from '../../../../../application/ports/output/agents/agent-executor.interface.js';

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function toTitleCase(text: string): string {
  return text.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Extract the quoted user input from the metadata generation prompt.
 * Prompt format: `...User request:\n"<input>"\n...`
 */
function extractUserInput(prompt: string): string | null {
  const match = prompt.match(/User request:\n"(.+?)"\n/s);
  return match ? match[1] : null;
}

function getDefaultBySchema(schema: Record<string, unknown>): unknown {
  const props = schema.properties as Record<string, unknown>;
  if (!props) return {};
  const result: Record<string, unknown> = {};
  for (const [key, prop] of Object.entries(props)) {
    const propSchema = prop as Record<string, unknown>;
    if (propSchema.type === 'array') {
      result[key] = [];
    } else if (propSchema.type === 'string') {
      result[key] = '';
    } else if (propSchema.type === 'object') {
      result[key] = {};
    } else {
      result[key] = null;
    }
  }
  return result;
}

export class MockAgentExecutorService implements IAgentExecutor {
  readonly agentType: AgentType = 'claude-code' as AgentType;

  async execute(prompt: string, options?: AgentExecutionOptions): Promise<AgentExecutionResult> {
    const userInput = extractUserInput(prompt);

    if (userInput) {
      const slug = toSlug(userInput);
      const name = toTitleCase(userInput);
      return {
        result: JSON.stringify({ slug, name, description: userInput }),
      };
    }

    // Check for acceptance criteria request (contains "acceptance criteria")
    if (prompt.toLowerCase().includes('acceptance criteria')) {
      return {
        result: JSON.stringify({
          criteria: [
            '- [ ] Implement the requested feature',
            '- [ ] Add tests',
            '- [ ] Update documentation',
          ],
        }),
      };
    }

    // Check for lane classification request (contains "Classify the GitHub issue")
    if (
      prompt.toLowerCase().includes('classify the github issue') ||
      prompt.toLowerCase().includes('contributor lane')
    ) {
      const laneMatch = prompt.toLowerCase().match(/title:\s*(.+?)(?:\n|$)/);
      const title = laneMatch ? laneMatch[1].trim() : 'unknown';
      let lane = 'infra';
      if (title.toLowerCase().includes('docs')) lane = 'docs';
      else if (title.toLowerCase().includes('ui') || title.toLowerCase().includes('web'))
        lane = 'ui';
      else if (title.toLowerCase().includes('cli') || title.toLowerCase().includes('command'))
        lane = 'cli';
      else if (title.toLowerCase().includes('agent') || title.toLowerCase().includes('llm'))
        lane = 'agents';
      return {
        result: JSON.stringify({
          lane,
          rationale: `Classified based on title keywords into the ${lane} lane.`,
        }),
      };
    }

    // Default fallback for any other prompt
    const schema = options?.outputSchema as Record<string, unknown> | undefined;
    return { result: JSON.stringify(schema?.properties ? getDefaultBySchema(schema) : {}) };
  }

  async *executeStream(
    prompt: string,
    options?: AgentExecutionOptions
  ): AsyncIterable<AgentExecutionStreamEvent> {
    const result = await this.execute(prompt, options);
    yield { type: 'result', content: result.result, timestamp: new Date() };
  }

  supportsFeature(_feature: AgentFeature): boolean {
    return false;
  }
}
