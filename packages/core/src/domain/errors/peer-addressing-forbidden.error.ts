/**
 * Peer Addressing Forbidden Error
 *
 * Thrown by the agent message bus when a message attempts peer addressing
 * (toKind === 'peer'). Hub-and-spoke topology is mandatory in v1
 * (research decision 3 of spec 093) — all inter-agent traffic must flow
 * through the supervisor or a logical hub.
 */
export class PeerAddressingForbiddenError extends Error {
  readonly code = 'PEER_ADDRESSING_FORBIDDEN';
  constructor(public readonly toKind: string) {
    super(
      `Peer addressing is forbidden — toKind="${toKind}" is not allowed. ` +
        `Use 'broadcast', 'supervisor', 'user', or 'agent' (for replies via correlationId).`
    );
    this.name = 'PeerAddressingForbiddenError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
