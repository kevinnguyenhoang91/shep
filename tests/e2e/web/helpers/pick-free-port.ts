import { createServer } from 'node:net';

/**
 * Pick an unused TCP port by asking the kernel for port 0 and reading
 * back what it assigned. Returned port is released immediately — the
 * caller is responsible for binding it before someone else does.
 *
 * Used by the e2e-mock harness so a running `pnpm dev:web` on 3001
 * can't interfere with tests (and vice-versa).
 */
export function pickFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      if (!addr || typeof addr === 'string') {
        srv.close();
        reject(new Error('Failed to determine a free port'));
        return;
      }
      const port = addr.port;
      srv.close(() => resolve(port));
    });
  });
}
