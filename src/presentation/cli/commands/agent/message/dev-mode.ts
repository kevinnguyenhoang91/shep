/**
 * Dev-mode guard for the dev-only `shep agent message` sub-namespace.
 *
 * Resolution order:
 *  - `SHEP_DEV_TOOLS=1` env var unconditionally enables it
 *  - Settings.featureFlags.debug enables it when settings are loaded
 *  - NODE_ENV !== 'production' enables it during local development
 *
 * Production binaries built with NODE_ENV=production therefore hide
 * the command unless the user explicitly opts in via env or settings.
 */

import { getSettings, hasSettings } from '@/infrastructure/services/settings.service.js';

export function isDevModeEnabled(): boolean {
  if (process.env.SHEP_DEV_TOOLS === '1' || process.env.SHEP_DEV_TOOLS === 'true') {
    return true;
  }
  if (hasSettings()) {
    if (getSettings().featureFlags?.debug === true) return true;
  }
  return process.env.NODE_ENV !== 'production';
}
