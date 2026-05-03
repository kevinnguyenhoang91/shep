/**
 * GetSupervisorPolicyUseCase
 *
 * Resolves the effective {@link SupervisorPolicy} for a scope using the
 * feature → scope fallback documented in research decision 7:
 *  - feature-scoped row first when `featureId` is supplied,
 *  - else fall back to the scope-level row,
 *  - else return null.
 *
 * `scopeType` is mandatory (NFR-7 cross-scope isolation); the use case
 * rejects empty scopeTypes rather than silently returning null so
 * callers cannot accidentally bypass scoping.
 */

import { inject, injectable } from 'tsyringe';

import type { ISupervisorPolicyRepository } from '../../ports/output/repositories/supervisor-policy-repository.interface.js';
import type { SupervisorPolicy } from '../../../domain/generated/output.js';

export interface GetSupervisorPolicyInput {
  scopeType: string;
  scopeId?: string;
  featureId?: string;
}

@injectable()
export class GetSupervisorPolicyUseCase {
  constructor(
    @inject('ISupervisorPolicyRepository')
    private readonly policyRepository: ISupervisorPolicyRepository
  ) {}

  async execute(input: GetSupervisorPolicyInput): Promise<SupervisorPolicy | null> {
    if (typeof input.scopeType !== 'string' || input.scopeType.trim().length === 0) {
      throw new Error(
        'scopeType is required to resolve a supervisor policy (NFR-7 scope isolation)'
      );
    }
    return this.policyRepository.findPolicyForScope(
      input.scopeType,
      input.scopeId,
      input.featureId
    );
  }
}
