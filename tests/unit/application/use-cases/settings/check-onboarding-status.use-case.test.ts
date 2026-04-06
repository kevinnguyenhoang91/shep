import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';

import { CheckOnboardingStatusUseCase } from '@/application/use-cases/settings/check-onboarding-status.use-case.js';
import type { ISettingsReader } from '@/application/ports/output/services/settings-reader.interface.js';
import type { Settings } from '@/domain/generated/output.js';

describe('CheckOnboardingStatusUseCase', () => {
  let useCase: CheckOnboardingStatusUseCase;
  let mockSettingsReader: ISettingsReader;

  function createUseCase(onboardingComplete: boolean): CheckOnboardingStatusUseCase {
    mockSettingsReader = {
      getSettings: () => ({ onboardingComplete }) as Settings,
      hasSettings: () => true,
    };
    return new CheckOnboardingStatusUseCase(mockSettingsReader);
  }

  beforeEach(() => {
    useCase = createUseCase(false);
  });

  it('should return { isComplete: true } when onboardingComplete is true', async () => {
    useCase = createUseCase(true);
    const result = await useCase.execute();
    expect(result).toEqual({ isComplete: true });
  });

  it('should return { isComplete: false } when onboardingComplete is false', async () => {
    useCase = createUseCase(false);
    const result = await useCase.execute();
    expect(result).toEqual({ isComplete: false });
  });
});
