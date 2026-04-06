import { describe, expect, it } from 'vitest';
import { resolve, sep, join } from 'node:path';
import { mkdtempSync, mkdirSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';

import {
  normalizePath,
  ensureContainedPath,
  isSamePath,
} from '@/infrastructure/services/filesystem/path-sanitizers.js';

describe('normalizePath', () => {
  it('resolves a relative path to absolute', () => {
    const result = normalizePath('some/relative/path');
    expect(result).toBe(resolve('some/relative/path'));
  });

  it('handles a non-existent path without throwing', () => {
    const fakePath = join(tmpdir(), 'non-existent-path-sanitizer-test-abc123');
    const result = normalizePath(fakePath);
    expect(result).toBe(resolve(fakePath));
  });

  it('resolves an existing directory to its real path', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'path-sanitizer-'));
    try {
      const result = normalizePath(tmp);
      // On Windows, realpathSync resolves 8.3 short paths; on all platforms
      // the result must be an absolute, normalized path.
      expect(result).toBeTruthy();
      expect(result).toBe(resolve(result));
    } finally {
      rmdirSync(tmp);
    }
  });
});

describe('ensureContainedPath', () => {
  it('returns normalized path for a valid contained path', () => {
    const container = mkdtempSync(join(tmpdir(), 'container-'));
    const child = join(container, 'subdir');
    mkdirSync(child);
    try {
      const result = ensureContainedPath(child, container);
      expect(result).toBeTruthy();
    } finally {
      rmdirSync(child);
      rmdirSync(container);
    }
  });

  it('allows same path (target === container)', () => {
    const container = mkdtempSync(join(tmpdir(), 'same-path-'));
    try {
      const result = ensureContainedPath(container, container);
      expect(result).toBe(normalizePath(container));
    } finally {
      rmdirSync(container);
    }
  });

  it('throws on path traversal with ..', () => {
    const container = mkdtempSync(join(tmpdir(), 'traversal-'));
    const escaped = join(container, '..', 'etc', 'passwd');
    try {
      expect(() => ensureContainedPath(escaped, container)).toThrow(/path traversal detected/i);
    } finally {
      rmdirSync(container);
    }
  });

  it('throws on prefix attack (e.g. /attachments-evil vs /attachments)', () => {
    // Create two sibling directories where one name is a prefix of the other
    const base = mkdtempSync(join(tmpdir(), 'prefix-'));
    const container = join(base, 'attachments');
    const evil = join(base, 'attachments-evil');
    mkdirSync(container);
    mkdirSync(evil);
    try {
      expect(() => ensureContainedPath(evil, container)).toThrow(/path traversal detected/i);
    } finally {
      rmdirSync(evil);
      rmdirSync(container);
      rmdirSync(base);
    }
  });

  it('throws for a completely unrelated path', () => {
    const container = mkdtempSync(join(tmpdir(), 'contained-'));
    const unrelated = mkdtempSync(join(tmpdir(), 'unrelated-'));
    try {
      expect(() => ensureContainedPath(unrelated, container)).toThrow(/path traversal detected/i);
    } finally {
      rmdirSync(unrelated);
      rmdirSync(container);
    }
  });
});

describe('isSamePath', () => {
  it('returns true for identical paths', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'same-'));
    try {
      expect(isSamePath(tmp, tmp)).toBe(true);
    } finally {
      rmdirSync(tmp);
    }
  });

  it('returns true for equivalent paths with trailing slash', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'trailing-'));
    try {
      expect(isSamePath(tmp, tmp + sep)).toBe(true);
    } finally {
      rmdirSync(tmp);
    }
  });

  it('returns false for different paths', () => {
    const a = mkdtempSync(join(tmpdir(), 'diff-a-'));
    const b = mkdtempSync(join(tmpdir(), 'diff-b-'));
    try {
      expect(isSamePath(a, b)).toBe(false);
    } finally {
      rmdirSync(a);
      rmdirSync(b);
    }
  });
});
