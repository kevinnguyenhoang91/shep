/**
 * DisableSupervisorUseCase
 *
 * Sets `enabled = false` on the {@link SupervisorPolicy} for the
 * (appId, featureId?) scope without touching any other field. Idempotent
 * — calling disable on an already-disabled policy returns the unchanged
 * row but still bumps `updatedAt` for audit clarity.
 */

import { inject, injectable } from 'tsyringe';

import type { ISupervisorPolicyRepository } from '../../ports/output/repositories/supervisor-policy-repository.interface.js';
import type { SupervisorPolicy } from '../../../domain/generated/output.js';
import { SupervisorPolicyNotFoundError } from '../../../domain/errors/supervisor-policy-not-found.error.js';

export interface DisableSupervisorInput {
  appId: string;
  featureId?: string;
}

@injectable()
export class DisableSupervisorUseCase {
  constructor(
    @inject('ISupervisorPolicyRepository')
    private readonly policyRepository: ISupervisorPolicyRepository
  ) {}

  async execute(input: DisableSupervisorInput): Promise<SupervisorPolicy> {
    const existing =
      input.featureId !== undefined
        ? await this.policyRepository.findByFeature(input.appId, input.featureId)
        : await this.policyRepository.findByApp(input.appId);

    if (!existing) {
      throw new SupervisorPolicyNotFoundError(input.appId, input.featureId);
    }

    const updated: SupervisorPolicy = {
      ...existing,
      enabled: false,
      updatedAt: new Date(),
    };
    await this.policyRepository.update(updated);
    return updated;
  }
}
