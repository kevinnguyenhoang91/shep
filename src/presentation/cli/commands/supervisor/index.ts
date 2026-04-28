/**
 * Supervisor Command
 *
 * Top-level `shep supervisor` command (spec 093). Manages a delegated
 * guardian agent that can advise, co-sign, or — in autonomous mode for
 * the configured scopes — approve / reject on the user's behalf.
 *
 * Subcommands:
 *   shep supervisor configure --app <id> [...]  Create or update a policy
 *   shep supervisor status --app <id> [...]     Show the current effective policy
 *   shep supervisor enable --app <id>           Flip enabled flag on
 *   shep supervisor disable --app <id>          Flip enabled flag off
 *   shep supervisor approve --run <id>          Approve as supervisor:<id>
 *   shep supervisor reject  --run <id>          Reject as supervisor:<id>
 *
 * The whole command tree is hidden from --help when the collaboration
 * feature flag is off (NFR-14 byte-identical default).
 */

import { Command } from 'commander';
import { getSettings, hasSettings } from '@/infrastructure/services/settings.service.js';
import { createConfigureCommand } from './configure.command.js';
import { createStatusCommand } from './status.command.js';
import { createEnableCommand } from './enable.command.js';
import { createDisableCommand } from './disable.command.js';
import { createApproveCommand } from './approve.command.js';
import { createRejectCommand } from './reject.command.js';

function isCollaborationEnabled(): boolean {
  if (!hasSettings()) return false;
  return getSettings().featureFlags?.collaboration === true;
}

export function createSupervisorCommand(): Command {
  const supervisor = new Command('supervisor')
    .description('Manage the delegated supervisor agent (spec 093)')
    .addCommand(createConfigureCommand())
    .addCommand(createStatusCommand())
    .addCommand(createEnableCommand())
    .addCommand(createDisableCommand())
    .addCommand(createApproveCommand())
    .addCommand(createRejectCommand());

  if (!isCollaborationEnabled()) {
    // Hide the entire surface when the flag is off so byte-identical CLI
    // help output is preserved unless the user opts in.
    (supervisor as unknown as { _hidden: boolean })._hidden = true;
  }

  return supervisor;
}
