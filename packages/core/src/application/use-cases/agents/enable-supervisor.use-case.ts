/**
 * EnableSupervisorUseCase
 *
 * Sets `enabled = true` on the {@link SupervisorPolicy} for the
 * (scopeType, scopeId?, featureId?) scope without touching any other
 * field. Idempotent — calling enable on an already-enabled policy
 * returns the unchanged row but still bumps `updatedAt` for audit
 * clarity.
 */

import { inject, injectable } from 'tsyringe';

import type { ISupervisorPolicyRepository } from '../../ports/output/repositories/supervisor-policy-repository.interface.js';
import type { SupervisorPolicy } from '../../../domain/generated/output.js';
import { SupervisorPolicyNotFoundError } from '../../../domain/errors/supervisor-policy-not-found.error.js';

export interface EnableSupervisorInput {
  scopeType: string;
  scopeId?: string;
  featureId?: string;
}

@injectable()
export class EnableSupervisorUseCase {
  constructor(
    @inject('ISupervisorPolicyRepository')
    private readonly policyRepository: ISupervisorPolicyRepository
  ) {}

  async execute(input: EnableSupervisorInput): Promise<SupervisorPolicy> {
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
      enabled: true,
      updatedAt: new Date(),
    };
    await this.policyRepository.update(updated);
    return updated;
  }
}
