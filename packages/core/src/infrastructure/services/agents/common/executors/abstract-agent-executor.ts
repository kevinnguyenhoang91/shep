/**
 * Abstract Agent Executor
 *
 * Base class for all agent executor implementations. Extracts common patterns
 * shared across Claude Code, Cursor, Codex CLI, Copilot CLI, and Gemini CLI
 * executors:
 *
 * - Debug logging with timestamp + phase prefix (log method)
 * - Silent flag to suppress logging per-call
 * - Common spawn options (stdio piping, windowsHide, CLAUDECODE env stripping)
 *
 * Subclasses implement the agent-specific IAgentExecutor interface methods
 * (execute, executeStream, supportsFeature, buildArgs, etc.) and may extend
 * buildBaseSpawnOptions() for auth token injection or other customizations.
 */

import { getCurrentPhase, getLogPrefix } from '../../feature-agent/log-context.js';
import type { SpawnFunction } from '../types.js';

export abstract class AbstractAgentExecutor {
  /** When true, suppresses debug logging (set per-call via options.silent) */
  protected silent = false;

  constructor(protected readonly spawn: SpawnFunction) {}

  /** Debug logging — writes to stdout so it appears in the worker log file */
  protected log(message: string): void {
    if (this.silent) return;
    const ts = new Date().toISOString();
    process.stdout.write(`[${ts}] ${getCurrentPhase()}${getLogPrefix()}${message}\n`);
  }

  /**
   * Build common spawn options shared by all agent executors.
   *
   * Includes:
   * - stdio: ['pipe', 'pipe', 'pipe'] — explicit piping for detached workers
   * - windowsHide: true on Windows — prevents blank console windows
   * - env: process.env with CLAUDECODE stripped — prevents nested session errors
   *
   * Subclasses can extend the returned object for agent-specific needs
   * (e.g. injecting auth tokens into the environment).
   */
  protected buildBaseSpawnOptions(cwd?: string): Record<string, unknown> {
    const spawnOpts: Record<string, unknown> = {};
    if (cwd) spawnOpts.cwd = cwd;

    // Explicitly pipe stdio so streams are available even when parent disconnects
    spawnOpts.stdio = ['pipe', 'pipe', 'pipe'];

    // On Windows: windowsHide=true to prevent blank console windows.
    if (process.platform === 'win32') {
      spawnOpts.windowsHide = true;
    }

    // Strip CLAUDECODE env var to prevent "nested session" error when shep
    // is invoked from within a Claude Code session. The claude CLI checks for
    // this variable and refuses to start if it's set.
    const { CLAUDECODE: _, ...cleanEnv } = process.env;
    spawnOpts.env = cleanEnv;

    return spawnOpts;
  }
}
