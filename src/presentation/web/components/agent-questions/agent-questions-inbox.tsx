'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AgentQuestionKind,
  AgentQuestionStatus,
  type AgentQuestion,
} from '@shepai/core/domain/generated/output';
import { answerAgentQuestion, cancelAgentQuestion } from '@/app/actions/agent-questions';

const KIND_VARIANT: Record<AgentQuestionKind, 'default' | 'destructive' | 'secondary'> = {
  [AgentQuestionKind.info]: 'secondary',
  [AgentQuestionKind.question]: 'default',
  [AgentQuestionKind.blocking]: 'destructive',
};

const STATUS_VARIANT: Record<
  AgentQuestionStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  [AgentQuestionStatus.pending]: 'default',
  [AgentQuestionStatus.answered]: 'secondary',
  [AgentQuestionStatus.cancelled]: 'outline',
  [AgentQuestionStatus.expired]: 'outline',
};

export interface AgentQuestionsInboxProps {
  /** Questions returned by ListAgentQuestionsUseCase. */
  initialQuestions: AgentQuestion[];
  /** Default status filter applied at first render (e.g. 'pending'). */
  initialStatusFilter?: AgentQuestionStatus | 'all';
  /** Default urgency filter applied at first render. */
  initialKindFilter?: AgentQuestionKind | 'all';
  /** Storybook escape hatch — render inline error banner. */
  errorMessage?: string | null;
  /** Override answer/cancel handlers (Storybook + tests). */
  answerOverride?: (input: {
    appId: string;
    questionId: string;
    answer: string;
    answeredBy: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  cancelOverride?: (input: {
    appId: string;
    questionId: string;
    cancelledBy: string;
    reason?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  /** Identity of the current user — used as `answeredBy`/`cancelledBy`. */
  currentActor?: string;
}

function parseOptions(json: string | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string');
    return [];
  } catch {
    return [];
  }
}

export function AgentQuestionsInbox({
  initialQuestions,
  initialStatusFilter = AgentQuestionStatus.pending,
  initialKindFilter = 'all',
  errorMessage = null,
  answerOverride,
  cancelOverride,
  currentActor = 'user:web',
}: AgentQuestionsInboxProps) {
  const [statusFilter, setStatusFilter] = useState<AgentQuestionStatus | 'all'>(
    initialStatusFilter
  );
  const [kindFilter, setKindFilter] = useState<AgentQuestionKind | 'all'>(initialKindFilter);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(errorMessage);
  const [questions, setQuestions] = useState<AgentQuestion[]>(initialQuestions);

  const filtered = useMemo(() => {
    return questions.filter((q) => {
      if (statusFilter !== 'all' && q.status !== statusFilter) return false;
      if (kindFilter !== 'all' && q.kind !== kindFilter) return false;
      return true;
    });
  }, [questions, statusFilter, kindFilter]);

  const submitAnswer = async (q: AgentQuestion, answer: string) => {
    if (!answer.trim()) {
      setError('Answer cannot be empty');
      return;
    }
    setError(null);
    setPendingId(q.id);
    try {
      const handler = answerOverride ?? answerAgentQuestion;
      const result = await handler({
        appId: q.appId ?? '',
        questionId: q.id,
        answer,
        answeredBy: currentActor,
      });
      if (!result.ok) {
        setError(result.error ?? 'Failed to submit answer');
        return;
      }
      setQuestions((prev) =>
        prev.map((row) =>
          row.id === q.id
            ? {
                ...row,
                status: AgentQuestionStatus.answered,
                answer,
                answeredBy: currentActor,
                answeredAt: new Date(),
              }
            : row
        )
      );
    } finally {
      setPendingId(null);
    }
  };

  const submitCancel = async (q: AgentQuestion) => {
    setError(null);
    setPendingId(q.id);
    try {
      const handler = cancelOverride ?? cancelAgentQuestion;
      const result = await handler({
        appId: q.appId ?? '',
        questionId: q.id,
        cancelledBy: currentActor,
      });
      if (!result.ok) {
        setError(result.error ?? 'Failed to cancel question');
        return;
      }
      setQuestions((prev) =>
        prev.map((row) =>
          row.id === q.id
            ? { ...row, status: AgentQuestionStatus.cancelled, answeredBy: currentActor }
            : row
        )
      );
    } finally {
      setPendingId(null);
    }
  };

  return (
    <section
      data-testid="agent-questions-inbox"
      className="flex flex-col gap-4"
      aria-label="Agent questions inbox"
    >
      <div className="flex flex-wrap items-end gap-3" data-testid="inbox-filters">
        <div className="flex flex-col gap-1">
          <Label htmlFor="status-filter">Status</Label>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as AgentQuestionStatus | 'all')}
          >
            <SelectTrigger id="status-filter" className="w-44" data-testid="status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value={AgentQuestionStatus.pending}>Pending</SelectItem>
              <SelectItem value={AgentQuestionStatus.answered}>Answered</SelectItem>
              <SelectItem value={AgentQuestionStatus.cancelled}>Cancelled</SelectItem>
              <SelectItem value={AgentQuestionStatus.expired}>Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="kind-filter">Urgency</Label>
          <Select
            value={kindFilter}
            onValueChange={(v) => setKindFilter(v as AgentQuestionKind | 'all')}
          >
            <SelectTrigger id="kind-filter" className="w-44" data-testid="kind-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value={AgentQuestionKind.info}>Info</SelectItem>
              <SelectItem value={AgentQuestionKind.question}>Question</SelectItem>
              <SelectItem value={AgentQuestionKind.blocking}>Blocking</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive" data-testid="inbox-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {filtered.length === 0 ? (
        <div
          data-testid="inbox-empty"
          className="text-muted-foreground rounded border border-dashed p-6 text-center text-sm"
        >
          No agent questions match the current filters.
        </div>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="inbox-list">
          {filtered.map((q) => (
            <QuestionRow
              key={q.id}
              question={q}
              busy={pendingId === q.id}
              draftAnswer={draftAnswers[q.id] ?? ''}
              onDraftChange={(value) => setDraftAnswers((prev) => ({ ...prev, [q.id]: value }))}
              onSubmitAnswer={(answer) => submitAnswer(q, answer)}
              onCancel={() => submitCancel(q)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

interface QuestionRowProps {
  question: AgentQuestion;
  busy: boolean;
  draftAnswer: string;
  onDraftChange: (value: string) => void;
  onSubmitAnswer: (answer: string) => void;
  onCancel: () => void;
}

function QuestionRow({
  question,
  busy,
  draftAnswer,
  onDraftChange,
  onSubmitAnswer,
  onCancel,
}: QuestionRowProps) {
  const options = parseOptions(question.optionsJson);
  const isPending = question.status === AgentQuestionStatus.pending;

  return (
    <li
      className="flex flex-col gap-3 rounded border p-4"
      data-testid={`question-row-${question.id}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant={KIND_VARIANT[question.kind] ?? 'secondary'} className="capitalize">
            {question.kind}
          </Badge>
          <Badge variant={STATUS_VARIANT[question.status] ?? 'outline'} className="capitalize">
            {question.status}
          </Badge>
          <span className="text-muted-foreground text-xs">
            run {question.agentRunId.slice(0, 8)}
          </span>
        </div>
        {question.featureId ? (
          <span className="text-muted-foreground text-xs">
            feature {question.featureId.slice(0, 8)}
          </span>
        ) : null}
      </header>

      <p className="text-sm whitespace-pre-wrap" data-testid={`question-prompt-${question.id}`}>
        {question.prompt}
      </p>

      {!isPending && question.answer ? (
        <p className="text-muted-foreground text-xs" data-testid={`question-answer-${question.id}`}>
          {question.status === AgentQuestionStatus.answered
            ? 'Answered'
            : question.status === AgentQuestionStatus.cancelled
              ? 'Cancelled'
              : 'Resolved'}
          {question.answeredBy ? ` by ${question.answeredBy}` : ''}: {question.answer}
        </p>
      ) : null}

      {isPending ? (
        <div className="flex flex-col gap-2">
          {options.length > 0 ? (
            <div className="flex flex-wrap gap-2" data-testid={`question-options-${question.id}`}>
              {options.map((opt) => (
                <Button
                  key={opt}
                  type="button"
                  variant="default"
                  size="sm"
                  disabled={busy}
                  onClick={() => onSubmitAnswer(opt)}
                  data-testid={`question-option-${question.id}-${opt}`}
                >
                  {opt}
                </Button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                value={draftAnswer}
                onChange={(e) => onDraftChange(e.target.value)}
                placeholder="Type an answer…"
                disabled={busy}
                data-testid={`question-input-${question.id}`}
              />
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => onSubmitAnswer(draftAnswer)}
                data-testid={`question-submit-${question.id}`}
              >
                Submit
              </Button>
            </div>
          )}
          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={onCancel}
              data-testid={`question-cancel-${question.id}`}
            >
              Cancel question
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
