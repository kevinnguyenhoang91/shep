/**
 * Supervisor Policy Not Found Error
 *
 * Thrown by EnableSupervisor / DisableSupervisor when no policy row
 * exists for the requested (appId, featureId?) scope.
 */
export class SupervisorPolicyNotFoundError extends Error {
  readonly code = 'SUPERVISOR_POLICY_NOT_FOUND';
  constructor(
    public readonly appId: string,
    public readonly featureId?: string
  ) {
    super(
      `No supervisor policy configured for appId=${appId}${
        featureId ? `, featureId=${featureId}` : ''
      }`
    );
    this.name = 'SupervisorPolicyNotFoundError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
