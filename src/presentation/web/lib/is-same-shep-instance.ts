import { isSamePath } from '@shepai/core/infrastructure/services/filesystem/path-sanitizers';

/**
 * Check if a target path is the same directory (or a worktree of) the
 * currently running shep instance. Starting a dev server there would spawn
 * another shep instance that conflicts with the shared ~/.shep/data DB.
 */
export function isSameShepInstance(targetPath: string): boolean {
  const instancePath = process.env.NEXT_PUBLIC_SHEP_INSTANCE_PATH ?? process.cwd();

  try {
    return isSamePath(targetPath, instancePath);
  } catch {
    return false;
  }
}
