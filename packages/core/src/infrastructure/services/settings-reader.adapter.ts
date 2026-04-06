/**
 * Settings Reader Adapter
 *
 * Infrastructure adapter implementing the ISettingsReader port interface.
 * Wraps the existing globalThis/process-based settings singleton so that
 * application and presentation layers can depend on the port interface
 * instead of importing the infrastructure singleton directly.
 */

import { injectable } from 'tsyringe';
import type { Settings } from '../../domain/generated/output.js';
import type { ISettingsReader } from '../../application/ports/output/services/settings-reader.interface.js';
import { getSettings, hasSettings } from './settings.service.js';

@injectable()
export class SettingsReaderAdapter implements ISettingsReader {
  getSettings(): Settings {
    return getSettings();
  }

  hasSettings(): boolean {
    return hasSettings();
  }
}
