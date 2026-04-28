/**
 * SupervisorActor Value Object Unit Tests
 *
 * Verifies parsing, equality, and the "user always wins" override
 * invariant from spec 093.
 */

import { describe, it, expect } from 'vitest';
import {
  InvalidSupervisorActorError,
  parseSupervisorActor,
  supervisorActor,
  userActor,
  SUPERVISOR_ACTOR_NAMESPACE_SUPERVISOR,
  SUPERVISOR_ACTOR_NAMESPACE_USER,
} from '@/domain/value-objects/supervisor-actor.js';

describe('SupervisorActor', () => {
  describe('parseSupervisorActor', () => {
    it('parses a user actor', () => {
      const actor = parseSupervisorActor('user:abc');
      expect(actor.namespace).toBe(SUPERVISOR_ACTOR_NAMESPACE_USER);
      expect(actor.id).toBe('abc');
      expect(actor.value).toBe('user:abc');
      expect(actor.toString()).toBe('user:abc');
    });

    it('parses a supervisor actor', () => {
      const actor = parseSupervisorActor('supervisor:xyz');
      expect(actor.namespace).toBe(SUPERVISOR_ACTOR_NAMESPACE_SUPERVISOR);
      expect(actor.id).toBe('xyz');
      expect(actor.value).toBe('supervisor:xyz');
    });

    it('rejects an unknown namespace', () => {
      expect(() => parseSupervisorActor('foo:1')).toThrow(InvalidSupervisorActorError);
    });

    it('rejects a missing id', () => {
      expect(() => parseSupervisorActor('user:')).toThrow(InvalidSupervisorActorError);
    });

    it('rejects a missing namespace', () => {
      expect(() => parseSupervisorActor(':abc')).toThrow(InvalidSupervisorActorError);
    });

    it('rejects an empty string', () => {
      expect(() => parseSupervisorActor('')).toThrow(InvalidSupervisorActorError);
    });

    it('rejects whitespace-only id', () => {
      expect(() => parseSupervisorActor('user:   ')).toThrow(InvalidSupervisorActorError);
    });

    it('rejects values with extra colons in the id', () => {
      expect(() => parseSupervisorActor('user:abc:def')).toThrow(InvalidSupervisorActorError);
    });

    it('rejects non-string values', () => {
      expect(() => parseSupervisorActor(undefined as unknown as string)).toThrow(
        InvalidSupervisorActorError
      );
      expect(() => parseSupervisorActor(123 as unknown as string)).toThrow(
        InvalidSupervisorActorError
      );
    });

    it('preserves prototype chain on the error class', () => {
      try {
        parseSupervisorActor('bad');
        throw new Error('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidSupervisorActorError);
        expect((err as Error).name).toBe('InvalidSupervisorActorError');
      }
    });
  });

  describe('helpers', () => {
    it('userActor returns a parsed user actor', () => {
      const actor = userActor('alice');
      expect(actor.value).toBe('user:alice');
    });

    it('supervisorActor returns a parsed supervisor actor', () => {
      const actor = supervisorActor('guardian-1');
      expect(actor.value).toBe('supervisor:guardian-1');
    });
  });

  describe('equals', () => {
    it('returns true for two actors with the same namespace and id', () => {
      const a = userActor('abc');
      const b = userActor('abc');
      expect(a.equals(b)).toBe(true);
    });

    it('returns false when ids differ', () => {
      expect(userActor('a').equals(userActor('b'))).toBe(false);
    });

    it('returns false when namespaces differ', () => {
      expect(userActor('a').equals(supervisorActor('a'))).toBe(false);
    });
  });

  describe('isUserOverrideOf — user always wins invariant', () => {
    it('returns true when self is a user actor and prior is a supervisor actor', () => {
      const user = userActor('alice');
      const supervisor = supervisorActor('guardian-1');
      expect(user.isUserOverrideOf(supervisor)).toBe(true);
    });

    it('returns true regardless of id values across the pair', () => {
      expect(userActor('a').isUserOverrideOf(supervisorActor('b'))).toBe(true);
      expect(userActor('a').isUserOverrideOf(supervisorActor('a'))).toBe(true);
    });

    it('returns false when self is a supervisor actor', () => {
      expect(supervisorActor('a').isUserOverrideOf(userActor('a'))).toBe(false);
      expect(supervisorActor('a').isUserOverrideOf(supervisorActor('b'))).toBe(false);
    });

    it('returns false when prior is also a user actor (user→user is not an override)', () => {
      expect(userActor('a').isUserOverrideOf(userActor('b'))).toBe(false);
    });
  });

  describe('immutability', () => {
    it('produces a frozen actor', () => {
      const actor = userActor('alice');
      expect(Object.isFrozen(actor)).toBe(true);
    });
  });
});
