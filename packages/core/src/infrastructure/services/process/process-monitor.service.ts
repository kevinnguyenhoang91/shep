/**
 * Process Monitor Service
 *
 * Infrastructure implementation of IProcessMonitorService.
 * Uses process.kill(pid, 0) to probe whether a process is alive
 * without sending an actual signal.
 *
 * Following Clean Architecture:
 * - Implements the application-layer port interface
 * - Wraps the existing isProcessAlive() utility
 */

import { injectable } from 'tsyringe';

import type { IProcessMonitorService } from '../../../application/ports/output/services/process-monitor.interface.js';

/**
 * Concrete process-monitor implementation using signal-0 probing.
 */
@injectable()
export class ProcessMonitorService implements IProcessMonitorService {
  /**
   * Check whether a process with the given PID is still running.
   *
   * Uses process.kill(pid, 0) which sends signal 0 (no-op) to test existence.
   * Returns false when the PID does not exist or belongs to a zombie.
   */
  isAlive(pid: number): boolean {
    if (!Number.isFinite(pid) || pid <= 0) {
      return false;
    }
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }
}
