/**
 * Unit tests for the Windows-safe exec wrapper.
 *
 * Background: on Windows we need `shell: true` to resolve `.cmd` shims
 * (agent CLIs like cursor-agent.cmd), but Node does not quote arguments
 * when shell is used, so any arg containing whitespace gets re-split by
 * cmd.exe — for example `-m "Initial commit"` becomes `-m Initial commit`
 * and git treats `commit` as a pathspec.
 *
 * The wrapper fixes this by quoting args before handing them to the
 * shell-enabled execFile, while passing through unchanged on non-Windows.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  quoteCmdArg,
  createSafeExecFileFn,
} from '../../../../../packages/core/src/infrastructure/services/exec/windows-safe-exec.js';

describe('quoteCmdArg', () => {
  it('returns simple args unchanged', () => {
    expect(quoteCmdArg('git')).toBe('git');
    expect(quoteCmdArg('commit')).toBe('commit');
    expect(quoteCmdArg('-m')).toBe('-m');
    expect(quoteCmdArg('--allow-empty')).toBe('--allow-empty');
  });

  it('wraps args containing spaces in double quotes', () => {
    expect(quoteCmdArg('Initial commit')).toBe('"Initial commit"');
    expect(quoteCmdArg('hello world foo')).toBe('"hello world foo"');
  });

  it('wraps args containing tabs in double quotes', () => {
    expect(quoteCmdArg('a\tb')).toBe('"a\tb"');
  });

  it('returns an empty quoted string for empty args', () => {
    expect(quoteCmdArg('')).toBe('""');
  });

  it('escapes embedded double quotes with a backslash', () => {
    expect(quoteCmdArg('say "hi"')).toBe('"say \\"hi\\""');
  });

  it('wraps args containing cmd.exe shell metacharacters', () => {
    expect(quoteCmdArg('a&b')).toBe('"a&b"');
    expect(quoteCmdArg('a|b')).toBe('"a|b"');
    expect(quoteCmdArg('a<b')).toBe('"a<b"');
    expect(quoteCmdArg('a>b')).toBe('"a>b"');
    expect(quoteCmdArg('a^b')).toBe('"a^b"');
    expect(quoteCmdArg('a(b)')).toBe('"a(b)"');
  });

  it('preserves paths with forward slashes unchanged', () => {
    expect(quoteCmdArg('/tmp/foo')).toBe('/tmp/foo');
    expect(quoteCmdArg('refs/heads/main')).toBe('refs/heads/main');
  });

  it('preserves paths with backslashes but no spaces unchanged', () => {
    expect(quoteCmdArg('C:\\Users\\foo')).toBe('C:\\Users\\foo');
  });

  it('quotes paths containing spaces', () => {
    expect(quoteCmdArg('C:\\Program Files\\git\\bin')).toBe('"C:\\Program Files\\git\\bin"');
  });
});

describe('createSafeExecFileFn', () => {
  it('returns the base function unchanged on non-Windows', async () => {
    const base = vi.fn().mockResolvedValue({ stdout: 'ok', stderr: '' });
    const fn = createSafeExecFileFn(base, false);

    await fn('git', ['commit', '-m', 'Initial commit'], { cwd: '/repo' });

    expect(base).toHaveBeenCalledTimes(1);
    expect(base).toHaveBeenCalledWith('git', ['commit', '-m', 'Initial commit'], { cwd: '/repo' });
  });

  it('on Windows, enables shell and quotes args containing spaces', async () => {
    const base = vi.fn().mockResolvedValue({ stdout: 'ok', stderr: '' });
    const fn = createSafeExecFileFn(base, true);

    await fn('git', ['commit', '--allow-empty', '--no-gpg-sign', '-m', 'Initial commit'], {
      cwd: '/repo',
    });

    expect(base).toHaveBeenCalledTimes(1);
    const [file, args, options] = base.mock.calls[0];
    expect(file).toBe('git');
    expect(args).toEqual(['commit', '--allow-empty', '--no-gpg-sign', '-m', '"Initial commit"']);
    expect(options).toMatchObject({ cwd: '/repo', shell: true, windowsHide: true });
  });

  it('on Windows, leaves args without spaces unchanged', async () => {
    const base = vi.fn().mockResolvedValue({ stdout: '', stderr: '' });
    const fn = createSafeExecFileFn(base, true);

    await fn('git', ['status', '--porcelain']);

    const [, args] = base.mock.calls[0];
    expect(args).toEqual(['status', '--porcelain']);
  });

  it('on Windows, preserves caller-supplied options and merges shell flags', async () => {
    const base = vi.fn().mockResolvedValue({ stdout: '', stderr: '' });
    const fn = createSafeExecFileFn(base, true);

    await fn('git', ['log'], { cwd: '/repo', env: { GIT_TERMINAL_PROMPT: '0' } });

    const [, , options] = base.mock.calls[0];
    expect(options).toMatchObject({
      cwd: '/repo',
      env: { GIT_TERMINAL_PROMPT: '0' },
      shell: true,
      windowsHide: true,
    });
  });

  it('on Windows, propagates the resolved value from the base function', async () => {
    const base = vi.fn().mockResolvedValue({ stdout: 'hello', stderr: 'warn' });
    const fn = createSafeExecFileFn(base, true);

    const result = await fn('git', ['--version']);

    expect(result).toEqual({ stdout: 'hello', stderr: 'warn' });
  });

  it('on Windows, propagates rejections from the base function', async () => {
    const base = vi.fn().mockRejectedValue(new Error('boom'));
    const fn = createSafeExecFileFn(base, true);

    await expect(fn('git', ['--version'])).rejects.toThrow('boom');
  });
});
