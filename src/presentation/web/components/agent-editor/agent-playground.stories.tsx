import type { Meta, StoryObj } from '@storybook/react';
import { AgentPlayground } from './agent-playground';

const meta: Meta<typeof AgentPlayground> = {
  title: 'AgentEditor/AgentPlayground',
  component: AgentPlayground,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AgentPlayground>;

function fakeStreamingFetch(chunks: string[]): typeof fetch {
  return (async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'delta', content: chunk })}\n\n`)
          );
          await new Promise((r) => setTimeout(r, 80));
        }
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'done', content: '' })}\n\n`)
        );
        controller.close();
      },
    });
    return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  }) as unknown as typeof fetch;
}

export const Default: Story = {
  args: {
    agentType: 'feature-agent',
    promptId: 'implement.system',
    fetchOverride: fakeStreamingFetch([
      'Sure — ',
      'here is a plan for that feature.\n\n',
      '1. Read the spec\n',
      '2. Write tests\n',
      '3. Implement',
    ]),
  },
};

export const WithInlineOverride: Story = {
  args: {
    agentType: 'supervisor-agent',
    promptId: 'evaluator.system',
    inlinePromptBody: 'NEW SUPERVISOR PROMPT (unsaved)',
    fetchOverride: fakeStreamingFetch(['Verdict: advise. Reason: looks fine.']),
  },
};
