/**
 * Settings Reader Interface
 *
 * Output port for reading application settings.
 * Infrastructure layer provides the concrete implementation that wraps
 * the globalThis/process-based settings singleton.
 *
 * Following Clean Architecture:
 * - Application layer depends on this interface (never on the infrastructure singleton)
 * - Infrastructure layer provides the concrete SettingsReaderAdapter
 */

import type { Settings } from '../../../../domain/generated/output.js';

/**
 * Port interface for reading application settings.
 *
 * Implementations must:
 * - Return the current in-memory Settings instance
 * - Indicate whether settings have been initialized
 */
export interface ISettingsReader {
  /**
   * Get the current application settings.
   *
   * @returns Current settings instance
   * @throws Error if settings haven't been initialized yet
   */
  getSettings(): Settings;

  /**
   * Check if settings have been initialized.
   *
   * @returns True if settings are initialized, false otherwise
   */
  hasSettings(): boolean;
}
