/**
 * File System Service
 *
 * Infrastructure implementation of IFileSystemService.
 * Wraps Node.js fs primitives behind the application-layer port interface
 * so that use cases and presentation layers never import fs directly.
 *
 * Following Clean Architecture:
 * - Implements the application-layer port interface
 * - All Node.js fs calls are confined to this adapter
 */

import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';

import { injectable } from 'tsyringe';

import type { IFileSystemService } from '../../../application/ports/output/services/file-system.interface.js';

/**
 * Concrete file-system adapter using Node.js fs module.
 */
@injectable()
export class FileSystemService implements IFileSystemService {
  async readFile(path: string): Promise<Buffer> {
    return readFile(path);
  }

  readFileSync(path: string, encoding?: BufferEncoding): string {
    return readFileSync(path, encoding ?? 'utf-8');
  }

  async writeFile(path: string, data: string | Buffer): Promise<void> {
    await writeFile(path, data);
  }

  exists(path: string): boolean {
    return existsSync(path);
  }

  readDir(path: string): string[] {
    return readdirSync(path);
  }

  mkdir(path: string, options?: { recursive?: boolean }): void {
    mkdirSync(path, options);
  }
}
