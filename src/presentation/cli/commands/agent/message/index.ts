/**
 * shep agent message
 *
 * Dev-only sub-namespace for poking the inter-agent message bus from
 * the command line. Only `send` exists today and is intentionally
 * hidden in production builds — it exists to help developers exercise
 * the bus without spinning up a feature agent.
 */

import { Command } from 'commander';
import { createSendCommand } from './send.command.js';
import { isDevModeEnabled } from './dev-mode.js';

export function createMessageCommand(): Command {
  const cmd = new Command('message')
    .description('[dev] inspect and inject inter-agent messages on the bus')
    .addCommand(createSendCommand());

  // Hide entirely outside dev mode so production users do not see the
  // command in --help output.
  if (!isDevModeEnabled()) {
    (cmd as unknown as { _hidden: boolean })._hidden = true;
  }

  return cmd;
}
