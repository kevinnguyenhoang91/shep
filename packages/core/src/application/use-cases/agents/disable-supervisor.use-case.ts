/**
 * DisableSupervisorUseCase
 *
 * Sets `enabled = false` on the {@link SupervisorPolicy} for the
 * (scopeType, scopeId?, featureId?) scope without touching any other
 * field. Idempotent — calling disable on an already-disabled policy
 * returns the unchanged row but still bumps `updatedAt` for audit
 * clarity.
 */

import { inject, injectable } from 'tsyringe';

import type { ISupervisorPolicyRepository } from '../../ports/output/repositories/supervisor-policy-repository.interface.js';
import type { SupervisorPolicy } from '../../../domain/generated/output.js';
import { SupervisorPolicyNotFoundError } from '../../../domain/errors/supervisor-policy-not-found.error.js';

export interface DisableSupervisorInput {
  scopeType: string;
  scopeId?: string;
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
        ? await this.policyRepository.findByScopeAndFeature(
            input.scopeType,
            input.scopeId,
            input.featureId
          )
        : await this.policyRepository.findByScope(input.scopeType, input.scopeId);

    if (!existing) {
      throw new SupervisorPolicyNotFoundError(input.scopeType, input.scopeId, input.featureId);
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
