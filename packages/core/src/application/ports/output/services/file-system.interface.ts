/**
 * File System Service Interface
 *
 * Output port for file system operations used by application-layer code.
 * Abstracts Node.js fs primitives behind a testable interface so that
 * use cases and presentation layers never import fs directly.
 *
 * Following Clean Architecture:
 * - Application / Presentation layers depend on this interface
 * - Infrastructure layer provides the concrete Node.js fs implementation
 */

/**
 * Port interface for file system operations.
 *
 * Implementations must:
 * - Use path.join / path.resolve internally (no hardcoded separators)
 * - Normalize paths to forward slashes where appropriate (cross-platform)
 * - Propagate fs errors as-is — callers handle ENOENT etc.
 */
export interface IFileSystemService {
  /**
   * Read the entire contents of a file asynchronously.
   *
   * @param path - Absolute path to the file
   * @returns Buffer with the file contents
   */
  readFile(path: string): Promise<Buffer>;

  /**
   * Read the entire contents of a file synchronously.
   *
   * @param path - Absolute path to the file
   * @param encoding - Optional encoding (defaults to utf-8)
   * @returns File contents as a string
   */
  readFileSync(path: string, encoding?: BufferEncoding): string;

  /**
   * Write data to a file, creating it if it does not exist and
   * overwriting it if it does.
   *
   * @param path - Absolute path to the file
   * @param data - Content to write
   */
  writeFile(path: string, data: string | Buffer): Promise<void>;

  /**
   * Check whether a file or directory exists at the given path.
   *
   * @param path - Absolute path to check
   * @returns true if the path exists
   */
  exists(path: string): boolean;

  /**
   * List the entries (files and directories) in a directory.
   *
   * @param path - Absolute path to the directory
   * @returns Array of entry names (not full paths)
   */
  readDir(path: string): string[];

  /**
   * Create a directory, optionally creating parent directories.
   *
   * @param path - Absolute path to the directory
   * @param options - Optional; set recursive to create parent dirs
   */
  mkdir(path: string, options?: { recursive?: boolean }): void;
}
