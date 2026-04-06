/**
 * Check Onboarding Status Use Case
 *
 * Reads the in-memory settings via the ISettingsReader port and returns
 * whether first-run onboarding has been completed.
 */

import { injectable, inject } from 'tsyringe';
import type { ISettingsReader } from '../../ports/output/services/settings-reader.interface.js';

/**
 * Use case for checking whether onboarding is complete.
 * Reads from the in-memory singleton (zero DB overhead).
 */
@injectable()
export class CheckOnboardingStatusUseCase {
  constructor(
    @inject('ISettingsReader')
    private readonly settingsReader: ISettingsReader
  ) {}

  async execute(): Promise<{ isComplete: boolean }> {
    const settings = this.settingsReader.getSettings();
    return { isComplete: settings.onboardingComplete };
  }
}
