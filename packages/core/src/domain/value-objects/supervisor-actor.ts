/**
 * SupervisorActor Value Object
 *
 * Encodes actor namespaces used to attribute approval-gate / question
 * decisions:
 * - `user:<id>`        — the human user
 * - `supervisor:<id>`  — a delegated supervisor agent
 *
 * The "user always wins" invariant from spec 093 is modelled here:
 * `isUserOverrideOf(prior)` returns true exactly when `self` is a user
 * actor and `prior` is a supervisor actor (any pair of ids), expressing
 * that a subsequent user action overrides a prior supervisor action on
 * the same gate / question.
 */

export const SUPERVISOR_ACTOR_NAMESPACE_USER = 'user';
export const SUPERVISOR_ACTOR_NAMESPACE_SUPERVISOR = 'supervisor';

const VALID_NAMESPACES = [
  SUPERVISOR_ACTOR_NAMESPACE_USER,
  SUPERVISOR_ACTOR_NAMESPACE_SUPERVISOR,
] as const;

export type SupervisorActorNamespace = (typeof VALID_NAMESPACES)[number];

export class InvalidSupervisorActorError extends Error {
  constructor(value: string) {
    super(`Invalid supervisor actor: "${value}" — expected "user:<id>" or "supervisor:<id>"`);
    this.name = 'InvalidSupervisorActorError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface SupervisorActor {
  readonly namespace: SupervisorActorNamespace;
  readonly id: string;
  readonly value: string;
  toString(): string;
  equals(other: SupervisorActor): boolean;
  isUserOverrideOf(prior: SupervisorActor): boolean;
}

class SupervisorActorImpl implements SupervisorActor {
  constructor(
    public readonly namespace: SupervisorActorNamespace,
    public readonly id: string
  ) {
    Object.freeze(this);
  }

  get value(): string {
    return `${this.namespace}:${this.id}`;
  }

  toString(): string {
    return this.value;
  }

  equals(other: SupervisorActor): boolean {
    return this.namespace === other.namespace && this.id === other.id;
  }

  isUserOverrideOf(prior: SupervisorActor): boolean {
    return (
      this.namespace === SUPERVISOR_ACTOR_NAMESPACE_USER &&
      prior.namespace === SUPERVISOR_ACTOR_NAMESPACE_SUPERVISOR
    );
  }
}

function isValidNamespace(candidate: string): candidate is SupervisorActorNamespace {
  return (VALID_NAMESPACES as readonly string[]).includes(candidate);
}

function buildActor(namespace: SupervisorActorNamespace, id: string): SupervisorActor {
  return new SupervisorActorImpl(namespace, id);
}

/**
 * Parses an actor string of the form `<namespace>:<id>`.
 * Throws {@link InvalidSupervisorActorError} on malformed input.
 */
export function parseSupervisorActor(value: string): SupervisorActor {
  if (typeof value !== 'string') {
    throw new InvalidSupervisorActorError(String(value));
  }
  const colonIndex = value.indexOf(':');
  if (colonIndex <= 0 || colonIndex === value.length - 1) {
    throw new InvalidSupervisorActorError(value);
  }
  const namespace = value.slice(0, colonIndex);
  const id = value.slice(colonIndex + 1);
  if (!isValidNamespace(namespace)) {
    throw new InvalidSupervisorActorError(value);
  }
  if (id.includes(':') || id.trim().length === 0) {
    throw new InvalidSupervisorActorError(value);
  }
  return buildActor(namespace, id);
}

export function userActor(id: string): SupervisorActor {
  return parseSupervisorActor(`${SUPERVISOR_ACTOR_NAMESPACE_USER}:${id}`);
}

export function supervisorActor(id: string): SupervisorActor {
  return parseSupervisorActor(`${SUPERVISOR_ACTOR_NAMESPACE_SUPERVISOR}:${id}`);
}
