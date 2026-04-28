/**
 * shep agent questions
 *
 * Sub-namespace under `shep agent` for the unified question pipeline
 * introduced by spec 093. Subcommands list pending questions, submit
 * answers, and cancel them.
 *
 * Usage:
 *   shep agent questions ls --app <id> [--status pending]
 *   shep agent questions answer <id> --app <id> --answer <text>
 *   shep agent questions cancel <id> --app <id> [--reason <text>]
 *
 * The whole sub-namespace hides itself from --help when the
 * collaboration feature flag is off.
 */

import { Command } from 'commander';
import { getSettings, hasSettings } from '@/infrastructure/services/settings.service.js';
import { createListCommand } from './ls.command.js';
import { createAnswerCommand } from './answer.command.js';
import { createCancelCommand } from './cancel.command.js';

function isCollaborationEnabled(): boolean {
  if (!hasSettings()) return false;
  return getSettings().featureFlags?.collaboration === true;
}

export function createQuestionsCommand(): Command {
  const cmd = new Command('questions')
    .description('Manage agent questions raised during interactive and background runs')
    .addCommand(createListCommand())
    .addCommand(createAnswerCommand())
    .addCommand(createCancelCommand());

  if (!isCollaborationEnabled()) {
    (cmd as unknown as { _hidden: boolean })._hidden = true;
  }

  return cmd;
}
