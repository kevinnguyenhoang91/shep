/**
 * Invalid Supervisor Policy Error
 *
 * Thrown by ConfigureSupervisor / EnableSupervisor / DisableSupervisor
 * use cases when the supplied policy fields fail validation
 * (unknown autonomy enum, malformed gate-authority map, malformed
 * policy-rules array, missing appId, etc.).
 */
export class InvalidSupervisorPolicyError extends Error {
  readonly code = 'INVALID_SUPERVISOR_POLICY';
  constructor(
    public readonly field: string,
    public readonly reason: string
  ) {
    super(`Invalid supervisor policy: ${field} — ${reason}`);
    this.name = 'InvalidSupervisorPolicyError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
