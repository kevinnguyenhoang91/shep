import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgentQuestionsInbox } from '@/components/agent-questions/agent-questions-inbox';
import {
  AgentQuestionAnswerer,
  AgentQuestionKind,
  AgentQuestionStatus,
  type AgentQuestion,
} from '@/domain/generated/output';

function question(overrides: Partial<AgentQuestion> = {}): AgentQuestion {
  return {
    id: 'q-1',
    appId: 'app-1',
    featureId: 'feat-1',
    agentRunId: 'run-abcd1234',
    kind: AgentQuestionKind.question,
    prompt: 'Should we ship?',
    optionsJson: undefined,
    answerer: AgentQuestionAnswerer.user,
    status: AgentQuestionStatus.pending,
    createdAt: '2026-04-29T09:00:00Z',
    updatedAt: '2026-04-29T09:00:00Z',
    ...overrides,
  };
}

describe('AgentQuestionsInbox', () => {
  it('renders the empty state when no questions match the filters', () => {
    render(<AgentQuestionsInbox initialQuestions={[]} />);
    expect(screen.getByTestId('inbox-empty')).toBeInTheDocument();
  });

  it('lists pending questions by default', () => {
    render(
      <AgentQuestionsInbox
        initialQuestions={[
          question({ id: 'q-pending' }),
          question({ id: 'q-answered', status: AgentQuestionStatus.answered }),
        ]}
      />
    );
    expect(screen.getByTestId('question-row-q-pending')).toBeInTheDocument();
    expect(screen.queryByTestId('question-row-q-answered')).not.toBeInTheDocument();
  });

  it('invokes the answer handler when an option is chosen', async () => {
    const onAnswer = vi.fn().mockResolvedValue({ ok: true });
    const user = userEvent.setup();

    render(
      <AgentQuestionsInbox
        initialQuestions={[
          question({
            id: 'q-options',
            optionsJson: JSON.stringify(['approve', 'reject']),
          }),
        ]}
        answerOverride={onAnswer}
      />
    );

    await user.click(screen.getByTestId('question-option-q-options-approve'));

    await waitFor(() => {
      expect(onAnswer).toHaveBeenCalledOnce();
    });
    expect(onAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: 'app-1',
        questionId: 'q-options',
        answer: 'approve',
      })
    );
  });

  it('submits a free-form answer when no options are present', async () => {
    const onAnswer = vi.fn().mockResolvedValue({ ok: true });
    const user = userEvent.setup();

    render(
      <AgentQuestionsInbox
        initialQuestions={[question({ id: 'q-free' })]}
        answerOverride={onAnswer}
      />
    );

    await user.type(screen.getByTestId('question-input-q-free'), 'use react-flow');
    await user.click(screen.getByTestId('question-submit-q-free'));

    await waitFor(() => {
      expect(onAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          questionId: 'q-free',
          answer: 'use react-flow',
        })
      );
    });
  });

  it('renders an inline error when the answer handler fails', async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn().mockResolvedValue({ ok: false, error: 'boom' });

    render(
      <AgentQuestionsInbox
        initialQuestions={[
          question({
            id: 'q-err',
            optionsJson: JSON.stringify(['ok']),
          }),
        ]}
        answerOverride={onAnswer}
      />
    );

    await user.click(screen.getByTestId('question-option-q-err-ok'));
    expect(await screen.findByTestId('inbox-error')).toHaveTextContent('boom');
  });

  it('renders the urgency and status filters', () => {
    render(<AgentQuestionsInbox initialQuestions={[]} />);
    expect(screen.getByTestId('status-filter')).toBeInTheDocument();
    expect(screen.getByTestId('kind-filter')).toBeInTheDocument();
  });
});
