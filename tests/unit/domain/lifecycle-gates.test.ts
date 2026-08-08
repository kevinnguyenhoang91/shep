/**
 * Lifecycle Gates Unit Tests
 *
 * Guards invariants about the SdlcLifecycle enum and lifecycle gate sets.
 */

import { describe, it, expect } from 'vitest';
import { SdlcLifecycle } from '@/domain/generated/output.js';
import {
  COMPLETED_LIFECYCLES,
  EXPLORING_TRANSITIONS,
  satisfiesDependencyGate,
} from '@/domain/lifecycle-gates.js';

describe('SdlcLifecycle', () => {
  it('should include a Pending value', () => {
    expect(SdlcLifecycle.Pending).toBe('Pending');
  });

  it('should include an Exploring value', () => {
    expect(SdlcLifecycle.Exploring).toBe('Exploring');
  });
});

describe('COMPLETED_LIFECYCLES', () => {
  it('should NOT contain SdlcLifecycle.Pending', () => {
    expect(COMPLETED_LIFECYCLES.has(SdlcLifecycle.Pending)).toBe(false);
  });

  it('should NOT contain SdlcLifecycle.Exploring', () => {
    expect(COMPLETED_LIFECYCLES.has(SdlcLifecycle.Exploring)).toBe(false);
  });

  it('should contain Maintain — the only lifecycle meaning the work landed', () => {
    expect(COMPLETED_LIFECYCLES.has(SdlcLifecycle.Maintain)).toBe(true);
    expect(COMPLETED_LIFECYCLES.size).toBe(1);
  });

  it('should NOT contain Implementation or Review — that work has not landed yet', () => {
    expect(COMPLETED_LIFECYCLES.has(SdlcLifecycle.Implementation)).toBe(false);
    expect(COMPLETED_LIFECYCLES.has(SdlcLifecycle.Review)).toBe(false);
  });
});

describe('satisfiesDependencyGate', () => {
  it('should open the gate only for Maintain', () => {
    expect(satisfiesDependencyGate({ lifecycle: SdlcLifecycle.Maintain })).toBe(true);
  });

  it('should keep the gate CLOSED while the parent is still implementing', () => {
    // The merge node sets Maintain only when the branch actually merged, and
    // Review when the PR is still open. A child that starts against either one
    // builds on work that can still change or may never land.
    expect(satisfiesDependencyGate({ lifecycle: SdlcLifecycle.Implementation })).toBe(false);
    expect(satisfiesDependencyGate({ lifecycle: SdlcLifecycle.Review })).toBe(false);
  });

  it('should keep the gate closed for pre-implementation states', () => {
    for (const lifecycle of [
      SdlcLifecycle.Started,
      SdlcLifecycle.Analyze,
      SdlcLifecycle.Requirements,
      SdlcLifecycle.Research,
      SdlcLifecycle.Planning,
      SdlcLifecycle.Pending,
      SdlcLifecycle.Exploring,
      SdlcLifecycle.Blocked,
      SdlcLifecycle.AwaitingUpstream,
      SdlcLifecycle.Deleting,
    ]) {
      expect(satisfiesDependencyGate({ lifecycle })).toBe(false);
    }
  });

  it('should keep the gate OPEN for a feature archived after it completed', () => {
    // Auto-archive moves every completed feature to Archived on a delay.
    // Archiving is a filing concern, not a rollback of progress — children
    // waiting on a completed-then-archived parent must still be released.
    expect(
      satisfiesDependencyGate({
        lifecycle: SdlcLifecycle.Archived,
        previousLifecycle: SdlcLifecycle.Maintain,
      })
    ).toBe(true);
  });

  it('should keep the gate CLOSED for a feature archived before it completed', () => {
    for (const previousLifecycle of [
      SdlcLifecycle.Planning,
      SdlcLifecycle.Implementation,
      SdlcLifecycle.Review,
    ]) {
      expect(
        satisfiesDependencyGate({ lifecycle: SdlcLifecycle.Archived, previousLifecycle })
      ).toBe(false);
    }
  });

  it('should keep the gate CLOSED for an archived feature with no recorded previous lifecycle', () => {
    expect(satisfiesDependencyGate({ lifecycle: SdlcLifecycle.Archived })).toBe(false);
  });
});

describe('EXPLORING_TRANSITIONS', () => {
  it('should allow transition from Exploring to Implementation (promote to fast)', () => {
    expect(EXPLORING_TRANSITIONS.has(SdlcLifecycle.Implementation)).toBe(true);
  });

  it('should allow transition from Exploring to Requirements (promote to regular)', () => {
    expect(EXPLORING_TRANSITIONS.has(SdlcLifecycle.Requirements)).toBe(true);
  });

  it('should allow transition from Exploring to Deleting (discard)', () => {
    expect(EXPLORING_TRANSITIONS.has(SdlcLifecycle.Deleting)).toBe(true);
  });

  it('should contain exactly 3 valid transitions', () => {
    expect(EXPLORING_TRANSITIONS.size).toBe(3);
  });

  it('should NOT allow transition from Exploring to Review', () => {
    expect(EXPLORING_TRANSITIONS.has(SdlcLifecycle.Review)).toBe(false);
  });

  it('should NOT allow transition from Exploring to Maintain', () => {
    expect(EXPLORING_TRANSITIONS.has(SdlcLifecycle.Maintain)).toBe(false);
  });

  it('should NOT allow transition from Exploring to Exploring (self-loop is implicit)', () => {
    expect(EXPLORING_TRANSITIONS.has(SdlcLifecycle.Exploring)).toBe(false);
  });
});
