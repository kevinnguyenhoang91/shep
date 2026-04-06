/**
 * Process Monitor Service Interface
 *
 * Output port for checking whether OS processes are alive.
 * Infrastructure layer provides a concrete implementation using
 * process.kill(pid, 0) (signal-0 probe).
 *
 * Following Clean Architecture:
 * - Application / Presentation layers depend on this interface
 * - Infrastructure layer provides concrete implementation
 */

/**
 * Port interface for querying process liveness.
 *
 * Implementations must:
 * - Return true only when the PID exists and is not a zombie
 * - Return false for invalid PIDs (negative, NaN, non-finite)
 * - Never throw — always return a boolean
 */
export interface IProcessMonitorService {
  /**
   * Check whether a process with the given PID is still running.
   *
   * @param pid - OS process identifier to probe
   * @returns true if the process is alive, false otherwise
   */
  isAlive(pid: number): boolean;
}
