/**
 * Windows-safe exec wrapper.
 *
 * On Windows we need `shell: true` with spawn/execFile so agent CLIs that
 * ship as `.cmd`/`.ps1` shims (e.g. `cursor-agent.cmd`) can be located.
 * The cost is that Node does NOT quote args when shell is used — it joins
 * them with spaces and hands the string to cmd.exe, which re-splits on
 * whitespace. Any arg containing a space gets broken in half — e.g.
 * `-m "Initial commit"` becomes `-m Initial commit` and git treats
 * `commit` as a pathspec.
 *
 * This module wraps a base execFile-compatible function so that, on
 * Windows, args are quoted for cmd.exe before being passed through with
 * `shell: true`. On non-Windows the base function is returned unchanged.
 */

export type ExecFileFn = (
  file: string,
  args: string[],
  options?: object
) => Promise<{ stdout: string; stderr: string }>;

// Whitespace + cmd.exe shell metacharacters that require the arg to be quoted
// before being handed to `cmd.exe /c` via Node's `shell: true`.
const CMD_META_CHARS = /[\s"&|<>^()]/;

/**
 * Quote a single argument for cmd.exe.
 *
 * - Empty strings become `""` so they survive shell splitting.
 * - Args without whitespace or metacharacters are returned unchanged.
 * - Otherwise the arg is wrapped in double quotes and any embedded
 *   double quotes are backslash-escaped.
 */
export function quoteCmdArg(arg: string): string {
  if (arg === '') return '""';
  if (!CMD_META_CHARS.test(arg)) return arg;
  return `"${arg.replace(/"/g, '\\"')}"`;
}

/**
 * Build an execFile-compatible function that is safe to call on Windows
 * with `shell: true`. On non-Windows the base function is returned
 * unchanged so non-Windows platforms pay no cost.
 */
export function createSafeExecFileFn(base: ExecFileFn, isWindows: boolean): ExecFileFn {
  if (!isWindows) return base;

  return (file, args, options) => {
    const quotedArgs = args.map(quoteCmdArg);
    return base(file, quotedArgs, {
      ...(options ?? {}),
      shell: true,
      windowsHide: true,
    });
  };
}
