/**
 * Supervisor Policy Not Found Error
 *
 * Thrown by EnableSupervisor / DisableSupervisor when no policy row
 * exists for the requested (scopeType, scopeId?, featureId?) scope.
 */
export class SupervisorPolicyNotFoundError extends Error {
  readonly code = 'SUPERVISOR_POLICY_NOT_FOUND';
  constructor(
    public readonly scopeType: string,
    public readonly scopeId?: string,
    public readonly featureId?: string
  ) {
    super(
      `No supervisor policy configured for scopeType=${scopeType}${
        scopeId ? `, scopeId=${scopeId}` : ''
      }${featureId ? `, featureId=${featureId}` : ''}`
    );
    this.name = 'SupervisorPolicyNotFoundError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
