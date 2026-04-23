import { z } from 'zod';

/**
 * Scenario schema v1.
 *
 * Scenarios are declarative YAML files that drive the mocked agent in
 * web e2e tests. Each scenario declares a sequence of turns (text
 * deltas, tool calls) and optional mocks for remote services
 * (cloud deploy, GitHub).
 *
 * Keep this schema stable; bump `version` when making breaking
 * changes so old scenarios fail fast at load time with a clear error.
 */

const TextTurnSchema = z.object({
  kind: z.literal('text'),
  text: z.string(),
  /** Optional per-turn delay to exercise loading states in the UI. */
  delayMs: z.number().int().nonnegative().optional(),
});

const ToolCallTurnSchema = z.object({
  kind: z.literal('tool-call'),
  /** Tool name — resolved by the replay executor against registered handlers. */
  tool: z.string().min(1),
  /** Free-form input passed to the tool handler. */
  input: z.record(z.string(), z.unknown()).optional(),
  /** Optional scripted result to emit as a tool-result event. */
  result: z.unknown().optional(),
  delayMs: z.number().int().nonnegative().optional(),
});

export const TurnSchema = z.discriminatedUnion('kind', [TextTurnSchema, ToolCallTurnSchema]);

const CloudMockSchema = z
  .object({
    deploymentId: z.string().optional(),
    finalUrl: z.string().optional(),
    /** Scripted sequence of poll-status responses. */
    statusSequence: z
      .array(z.object({ status: z.string(), url: z.string().optional() }))
      .optional(),
  })
  .strict();

const GithubMockSchema = z
  .object({
    owners: z.array(z.string()).optional(),
    /** Sequence of createRepo outcomes: 'ok' | 'conflict'. Replay cycles through. */
    createRepoResults: z.array(z.enum(['ok', 'conflict'])).optional(),
  })
  .strict();

export const MocksSchema = z
  .object({
    cloud: CloudMockSchema.optional(),
    github: GithubMockSchema.optional(),
  })
  .strict()
  .optional();

export const ScenarioSchema = z
  .object({
    version: z.literal(1),
    /** Unique scenario name — referenced by ?e2eScenario=<name> and in .feature files. */
    name: z.string().min(1),
    /** Human-readable one-liner (optional). */
    description: z.string().optional(),
    turns: z.array(TurnSchema),
    mocks: MocksSchema,
  })
  .strict();

export type Scenario = z.infer<typeof ScenarioSchema>;
export type ScenarioTurn = z.infer<typeof TurnSchema>;
export type ScenarioTextTurn = z.infer<typeof TextTurnSchema>;
export type ScenarioToolCallTurn = z.infer<typeof ToolCallTurnSchema>;
export type ScenarioMocks = z.infer<typeof MocksSchema>;
