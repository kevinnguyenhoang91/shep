import { realpathSync } from 'node:fs';
import { resolve, sep, normalize } from 'node:path';

/**
 * Resolve a path to its canonical form (symlinks resolved, normalized).
 * Falls back to normalize(resolve()) if realpath fails (path doesn't exist yet).
 */
export function normalizePath(filePath: string): string {
  const resolved = resolve(filePath);
  try {
    return realpathSync(resolved);
  } catch {
    return normalize(resolved);
  }
}

/**
 * Verify that targetPath is contained within containerPath.
 * Returns the normalized target path if contained.
 * Throws if the target escapes the container (path traversal).
 * Uses realpath to defeat symlink attacks and trailing-separator
 * comparison to prevent prefix attacks (/foo vs /foobar).
 */
export function ensureContainedPath(targetPath: string, containerPath: string): string {
  const normalizedTarget = normalizePath(targetPath);
  const normalizedContainer = normalizePath(containerPath);

  if (
    normalizedTarget !== normalizedContainer &&
    !normalizedTarget.startsWith(normalizedContainer + sep)
  ) {
    throw new Error(`Path traversal detected: ${targetPath} is outside ${containerPath}`);
  }

  return normalizedTarget;
}

/**
 * Compare two paths for equality after normalization.
 * Handles symlinks, trailing slashes, and platform separator differences.
 */
export function isSamePath(a: string, b: string): boolean {
  return normalizePath(a) === normalizePath(b);
}
