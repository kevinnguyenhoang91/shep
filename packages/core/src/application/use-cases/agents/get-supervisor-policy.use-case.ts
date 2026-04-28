/**
 * GetSupervisorPolicyUseCase
 *
 * Resolves the effective {@link SupervisorPolicy} for a scope using the
 * feature → app fallback documented in research decision 7:
 *  - feature-scoped row first when `featureId` is supplied,
 *  - else fall back to the app-scoped row,
 *  - else return null.
 *
 * `appId` is mandatory (NFR-7 cross-app isolation); the use case
 * rejects empty appIds rather than silently returning null so callers
 * cannot accidentally bypass scoping.
 */

import { inject, injectable } from 'tsyringe';

import type { ISupervisorPolicyRepository } from '../../ports/output/repositories/supervisor-policy-repository.interface.js';
import type { SupervisorPolicy } from '../../../domain/generated/output.js';

export interface GetSupervisorPolicyInput {
  appId: string;
  featureId?: string;
}

@injectable()
export class GetSupervisorPolicyUseCase {
  constructor(
    @inject('ISupervisorPolicyRepository')
    private readonly policyRepository: ISupervisorPolicyRepository
  ) {}

  async execute(input: GetSupervisorPolicyInput): Promise<SupervisorPolicy | null> {
    if (typeof input.appId !== 'string' || input.appId.trim().length === 0) {
      throw new Error('appId is required to resolve a supervisor policy (NFR-7 scope isolation)');
    }
    return this.policyRepository.findPolicyForScope(input.appId, input.featureId);
  }
}
