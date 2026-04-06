'use server';

import { resolve } from '@/lib/server-container';
import type { ISettingsReader } from '@shepai/core/application/ports/output/services/settings-reader.interface';

/**
 * Check whether onboarding has been completed.
 * Delegates to the in-memory settings singleton (zero DB overhead).
 */
export async function isAgentSetupComplete(): Promise<boolean> {
  try {
    const settingsReader = resolve<ISettingsReader>('ISettingsReader');
    return settingsReader.getSettings().onboardingComplete;
  } catch {
    return false;
  }
}
