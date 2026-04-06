'use server';

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { execFile } from 'node:child_process';
import { IS_WINDOWS } from '@shepai/core/infrastructure/platform';
import { resolve } from '@/lib/server-container';
import type { ListToolsUseCase } from '@shepai/core/application/use-cases/tools/list-tools.use-case';

export interface AgentAuthForTypeStatus {
  agentType: string;
  installed: boolean;
  authenticated: boolean;
}

const AGENT_TOOL_MAP: Record<string, string> = {
  'claude-code': 'claude-code',
  cursor: 'cursor-cli',
  'gemini-cli': 'gemini-cli',
  copilot: 'copilot-cli',
};

const AGENT_BINARY_MAP: Record<string, string> = {
  'claude-code': 'claude',
  cursor: 'cursor-agent',
  'gemini-cli': 'gemini',
  copilot: 'copilot',
};

function tier1AuthCheck(agentType: string): boolean {
  const home = homedir();

  switch (agentType) {
    case 'claude-code': {
      if (process.env['ANTHROPIC_API_KEY']) return true;
      if (process.env['CLAUDE_CODE_USE_BEDROCK']) return true;
      if (process.env['CLAUDE_CODE_USE_VERTEX']) return true;
      if (process.env['CLAUDE_CODE_OAUTH_TOKEN']) return true;
      const credPath = join(home, '.claude', '.credentials.json');
      return existsSync(credPath);
    }
    case 'cursor': {
      if (process.env['CURSOR_API_KEY']) return true;
      const cursorDir = join(home, '.cursor');
      return existsSync(cursorDir);
    }
    case 'gemini-cli': {
      if (process.env['GEMINI_API_KEY']) return true;
      if (process.env['GOOGLE_API_KEY']) return true;
      if (process.env['GOOGLE_APPLICATION_CREDENTIALS']) return true;
      const accountsPath = join(home, '.gemini', 'google_accounts.json');
      return existsSync(accountsPath);
    }
    case 'copilot-cli': {
      if (process.env['GITHUB_TOKEN']) return true;
      if (process.env['GH_TOKEN']) return true;
      if (process.env['GITHUB_AUTH_TOKEN']) return true;
      const ghDir = IS_WINDOWS ? join(home, '.copilot') : join(home, '.config', 'gh');
      return existsSync(ghDir);
    }
    default:
      return true;
  }
}

function tier2AuthVerify(agentType: string, binaryName: string): Promise<boolean> {
  return new Promise((res) => {
    let cmd: string;
    let args: string[];

    switch (agentType) {
      case 'claude-code':
        cmd = binaryName;
        args = ['auth', 'status'];
        break;
      case 'cursor':
        cmd = binaryName;
        args = ['status'];
        break;
      case 'copilot-cli':
        cmd = 'gh';
        args = ['auth', 'status'];
        break;
      default:
        res(true);
        return;
    }

    try {
      const opts = IS_WINDOWS ? { timeout: 5000, windowsHide: true } : { timeout: 5000 };
      execFile(cmd, args, opts, (error) => {
        res(!error);
      });
    } catch {
      res(false);
    }
  });
}

/**
 * Check installation + auth status for a specific agent type.
 * Designed to be called per-agent from the picker UI.
 */
export async function checkAgentAuthForType(agentType: string): Promise<AgentAuthForTypeStatus> {
  const toolId = AGENT_TOOL_MAP[agentType] ?? null;
  const binaryName = AGENT_BINARY_MAP[agentType] ?? null;

  // Dev/demo agents and agents without a tool mapping are always available
  if (!toolId) {
    return { agentType, installed: true, authenticated: true };
  }

  // Check installation via tool registry
  let installed = false;
  try {
    const useCase = resolve<ListToolsUseCase>('ListToolsUseCase');
    const tools = await useCase.execute();
    const tool = tools.find((t) => t.id === toolId);
    installed = tool?.status.status === 'available';
  } catch {
    installed = false;
  }

  if (!installed) {
    return { agentType, installed: false, authenticated: false };
  }

  // Tier 1: instant file/env check
  const tier1 = tier1AuthCheck(agentType);
  if (!tier1) {
    return { agentType, installed: true, authenticated: false };
  }

  // Tier 2: subprocess verify
  let authenticated = true;
  if (binaryName) {
    authenticated = await tier2AuthVerify(agentType, binaryName);
  }

  return { agentType, installed: true, authenticated };
}
