/**
 * Rovo Dev CLI Executor Service
 *
 * Infrastructure implementation of IAgentExecutor for the Atlassian Rovo Dev CLI agent.
 * Executes prompts via the `rovo` CLI subprocess with JSON output format.
 *
 * Key characteristics:
 * - Prompt is delivered via stdin piping (avoids arg-length limits on Windows)
 * - Auth via ATLASSIAN_TOKEN or ROVO_TOKEN env vars, or ~/.rovo config directory
 * - JSON output format for structured result parsing
 *
 * TODO: Verify exact CLI flags against Rovo Dev CLI documentation when available.
 * Current flags are based on common patterns shared across similar AI CLI tools.
 *
 * Uses constructor dependency injection for the spawn function
 * to enable testability without mocking node:child_process directly.
 */

import type {
  AgentType,
  AgentFeature,
  AgentConfig,
} from '../../../../../domain/generated/output.js';
import type {
  IAgentExecutor,
  AgentExecutionOptions,
  AgentExecutionResult,
  AgentExecutionStreamEvent,
} from '../../../../../application/ports/output/agents/agent-executor.interface.js';
import { MAX_STDERR_BUFFER_SIZE, type SpawnFunction } from '../types.js';
import { AbstractAgentExecutor } from './abstract-agent-executor.js';

/** Features supported by Rovo Dev CLI */
const SUPPORTED_FEATURES = new Set<string>(['session-resume', 'streaming']);

/**
 * Base flags always passed to the rovo CLI for non-interactive headless operation.
 * - --auto-approve: bypass tool permission prompts (autonomous execution)
 * - --non-interactive: suppress interactive prompts
 *
 * Note: --output-format is added dynamically (json for execute, stream-json for executeStream).
 *
 * TODO: Verify these flags against official Rovo Dev CLI documentation.
 */
const BASE_FLAGS = ['--auto-approve', '--non-interactive'];

/**
 * Executor service for Atlassian Rovo Dev CLI agent.
 * Uses subprocess spawning to interact with the `rovo` CLI.
 */
export class RovoDevExecutorService extends AbstractAgentExecutor implements IAgentExecutor {
  readonly agentType: AgentType = 'rovo-dev' as AgentType;

  constructor(
    spawn: SpawnFunction,
    private readonly authConfig?: AgentConfig
  ) {
    super(spawn);
  }

  supportsFeature(feature: AgentFeature): boolean {
    return SUPPORTED_FEATURES.has(feature as string);
  }

  async execute(prompt: string, options?: AgentExecutionOptions): Promise<AgentExecutionResult> {
    this.silent = options?.silent ?? false;
    const args = this.buildArgs(options);
    const spawnOpts = this.buildSpawnOptions(options);

    this.log(
      `Spawning: rovo ${args.map((a) => (a.length > 80 ? `${a.slice(0, 77)}...` : a)).join(' ')}`
    );
    this.log(`Spawn cwd: ${(spawnOpts.cwd as string) ?? '(inherited)'}`);

    const proc = this.spawn('rovo', args, spawnOpts);
    this.log(`Subprocess PID: ${proc.pid ?? 'undefined (spawn may have failed)'}`);
    this.log(`Prompt length: ${prompt.length} chars (piped via stdin)`);

    // Pipe the prompt via stdin to avoid ENAMETOOLONG on Windows.
    if (proc.stdin) {
      proc.stdin.write(prompt);
      proc.stdin.end();
    }

    return new Promise<AgentExecutionResult>((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;

      if (options?.timeout) {
        timeoutId = setTimeout(() => {
          timedOut = true;
          proc.kill();
        }, options.timeout);
      }

      proc.stdout?.on('data', (chunk: Buffer | string) => {
        stdout += chunk.toString();
      });

      proc.stderr?.on('data', (chunk: Buffer | string) => {
        const data = chunk.toString();
        if (stderr.length < MAX_STDERR_BUFFER_SIZE) {
          stderr += data;
        }
        this.log(`stderr: ${data.trimEnd()}`);
      });

      proc.on('error', (error: Error & { code?: string }) => {
        this.log(`Process error event: ${error.message}`);
        if (timeoutId) clearTimeout(timeoutId);
        if (error.code === 'ENOENT') {
          reject(
            new Error(
              'Rovo Dev CLI ("rovo") not found. ' +
                'Install via: npm install -g @atlassian/rovo-dev-cli, ' +
                'then authenticate with: rovo auth login'
            )
          );
        } else {
          reject(error);
        }
      });

      proc.on('close', (code: number | null) => {
        this.log(`Process closed with code ${code}, stdout=${stdout.length} chars`);
        if (timeoutId) clearTimeout(timeoutId);

        if (timedOut) {
          reject(new Error('Agent execution timed out'));
          return;
        }

        if (code !== 0 && code !== null) {
          const authError = this.detectAuthError(stderr);
          if (authError) {
            reject(new Error(authError));
            return;
          }
          const message = stderr.trim()
            ? `Process exited with code ${code}: ${stderr.trim()}`
            : `Process exited with code ${code}`;
          reject(new Error(message));
          return;
        }

        try {
          const parsed = JSON.parse(stdout);
          const result: AgentExecutionResult = { result: parsed.response ?? parsed.result ?? '' };

          // TODO: Verify the session ID field name in Rovo Dev CLI JSON output
          if (parsed.session_id) result.sessionId = parsed.session_id;
          if (parsed.sessionId) result.sessionId = parsed.sessionId;

          const usage = this.extractUsage(parsed);
          if (usage) result.usage = usage;

          resolve(result);
        } catch {
          // If JSON parsing fails, treat raw stdout as the result text
          resolve({ result: stdout.trim() });
        }
      });
    });
  }

  async *executeStream(
    prompt: string,
    options?: AgentExecutionOptions
  ): AsyncIterable<AgentExecutionStreamEvent> {
    this.silent = options?.silent ?? false;
    // TODO: Verify Rovo Dev CLI supports a streaming output format flag
    const args = this.buildArgs(options, 'stream-json');
    const spawnOpts = this.buildSpawnOptions(options);
    const proc = this.spawn('rovo', args, spawnOpts);

    // Pipe the prompt via stdin to avoid ENAMETOOLONG on Windows.
    if (proc.stdin) {
      proc.stdin.write(prompt);
      proc.stdin.end();
    }

    let lineBuffer = '';
    let stderr = '';
    let timedOut = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const queue: (AgentExecutionStreamEvent | null)[] = [];
    let resolveWait: (() => void) | null = null;
    let spawnError: Error | null = null;

    function enqueue(event: AgentExecutionStreamEvent | null) {
      queue.push(event);
      if (resolveWait) {
        resolveWait();
        resolveWait = null;
      }
    }

    function waitForItem(): Promise<void> {
      if (queue.length > 0) return Promise.resolve();
      return new Promise<void>((r) => {
        resolveWait = r;
      });
    }

    if (options?.timeout) {
      timeoutId = setTimeout(() => {
        timedOut = true;
        proc.kill();
        enqueue({ type: 'error', content: 'Agent execution timed out', timestamp: new Date() });
        enqueue(null);
      }, options.timeout);
    }

    const processStreamLine = (line: string) => {
      try {
        const parsed = JSON.parse(line) as Record<string, unknown>;
        const type = parsed.type as string;

        if (type === 'assistant.message_delta' && parsed.delta) {
          enqueue({
            type: 'progress',
            content: parsed.delta as string,
            timestamp: new Date(),
          });
          return;
        }

        if (type === 'assistant.message' && parsed.content) {
          enqueue({
            type: 'progress',
            content: parsed.content as string,
            timestamp: new Date(),
          });
          return;
        }

        if (type === 'result') {
          enqueue({
            type: 'result',
            content: (parsed.response as string) ?? (parsed.result as string) ?? '',
            timestamp: new Date(),
          });
          return;
        }

        if (type === 'error') {
          enqueue({
            type: 'error',
            content: (parsed.message as string) ?? (parsed.content as string) ?? 'Unknown error',
            timestamp: new Date(),
          });
          return;
        }

        // Unknown event types — skip gracefully
      } catch {
        // Non-JSON line — emit as raw progress
        enqueue({ type: 'progress', content: line, timestamp: new Date() });
      }
    };

    proc.stdout?.on('data', (chunk: Buffer | string) => {
      lineBuffer += chunk.toString();
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        processStreamLine(trimmed);
      }
    });

    proc.stderr?.on('data', (chunk: Buffer | string) => {
      if (stderr.length < MAX_STDERR_BUFFER_SIZE) {
        stderr += chunk.toString();
      }
    });

    proc.on('error', (err: Error) => {
      if (timeoutId) clearTimeout(timeoutId);
      spawnError = err;
      enqueue(null);
    });

    proc.on('close', (code: number | null) => {
      if (timeoutId) clearTimeout(timeoutId);
      if (timedOut) return; // already handled by timeout callback

      if (lineBuffer.trim()) {
        processStreamLine(lineBuffer.trim());
      }

      if (code !== 0 && code !== null) {
        const authError = this.detectAuthError(stderr);
        const msg =
          authError ??
          (stderr.trim()
            ? `Process exited with code ${code}: ${stderr.trim()}`
            : `Process exited with code ${code}`);
        enqueue({ type: 'error', content: msg, timestamp: new Date() });
      }
      enqueue(null);
    });

    while (true) {
      await waitForItem();
      const item = queue.shift();
      if (item === null || item === undefined) {
        if (spawnError !== null) {
          yield {
            type: 'error' as const,
            content: (spawnError as Error).message,
            timestamp: new Date(),
          };
        }
        return;
      }
      yield item;
    }
  }

  /**
   * Build CLI args for the rovo invocation.
   * Prompt is piped via stdin — not passed as a CLI argument.
   */
  private buildArgs(options?: AgentExecutionOptions, outputFormat = 'json'): string[] {
    // Permission mode: strict omits --auto-approve (requires confirmation); default/autonomous keep it
    const flags =
      options?.permissionMode === 'strict'
        ? BASE_FLAGS.filter((f) => f !== '--auto-approve')
        : [...BASE_FLAGS];
    // -p flag signals that prompt comes from stdin pipe
    const args = ['-p', '--output-format', outputFormat, ...flags];

    if (options?.resumeSession) args.push('--resume', options.resumeSession);
    if (options?.model) args.push('--model', options.model);

    // TODO: Verify if Rovo Dev CLI supports --allowed-tools flag
    if (options?.allowedTools?.length) {
      // eslint-disable-next-line no-console -- intentional: surface limitation visibly in all log sinks
      console.warn(
        `[rovo-dev] allowedTools [${options.allowedTools.join(', ')}] may not be supported by Rovo Dev CLI — ` +
          'tool restrictions may NOT be enforced.'
      );
    }
    if (options?.systemPrompt) {
      this.log('systemPrompt option is not supported by Rovo Dev CLI — ignoring');
    }
    if (options?.outputSchema) {
      this.log('outputSchema option is not supported by Rovo Dev CLI — ignoring');
    }

    return args;
  }

  private buildSpawnOptions(options?: AgentExecutionOptions): Record<string, unknown> {
    const spawnOpts = this.buildBaseSpawnOptions(options?.cwd);

    // Inject ATLASSIAN_TOKEN / ROVO_TOKEN when using token auth
    if (this.authConfig?.authMethod === 'token' && this.authConfig.token) {
      const baseEnv = spawnOpts.env as Record<string, string | undefined>;
      spawnOpts.env = { ...baseEnv, ATLASSIAN_TOKEN: this.authConfig.token };
    }

    return spawnOpts;
  }

  /**
   * Extract token usage from the Rovo Dev CLI result.
   * Returns undefined if usage data is absent (does not throw).
   *
   * TODO: Verify the usage field structure in Rovo Dev CLI JSON output.
   */
  private extractUsage(
    parsed: Record<string, unknown>
  ): { inputTokens: number; outputTokens: number } | undefined {
    const usage = parsed.usage as Record<string, unknown> | undefined;
    if (!usage) return undefined;

    if (typeof usage.inputTokens === 'number' && typeof usage.outputTokens === 'number') {
      return { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens };
    }

    // Alternative field names
    if (typeof usage.input_tokens === 'number' && typeof usage.output_tokens === 'number') {
      return { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens };
    }

    return undefined;
  }

  /**
   * Detect authentication-related errors in stderr and return a user-friendly message.
   * Returns null if no auth error is detected.
   */
  private detectAuthError(stderr: string): string | null {
    if (!stderr) return null;
    const lowerStderr = stderr.toLowerCase();
    if (
      lowerStderr.includes('not logged in') ||
      lowerStderr.includes('authentication') ||
      lowerStderr.includes('auth') ||
      lowerStderr.includes('unauthorized') ||
      lowerStderr.includes('login required') ||
      lowerStderr.includes('invalid token')
    ) {
      return (
        'Rovo Dev CLI authentication required. ' +
        'Run: rovo auth login — or set ATLASSIAN_TOKEN / ROVO_TOKEN env var\n' +
        `Original error: ${stderr.trim()}`
      );
    }
    return null;
  }
}
