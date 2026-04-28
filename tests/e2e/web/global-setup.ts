import { openShepDb, setCollaborationFlag } from './helpers/collaboration-flag';

/**
 * Playwright global setup: flips the `collaboration` feature flag on in the
 * Shep SQLite database BEFORE Playwright starts the dev:web server.
 *
 * This is the only reliable way to enable a flag for end-to-end tests on a
 * cold-boot dev server — the `Settings` singleton is loaded once at startup
 * and cached in-process, so DB writes after the server is running do not
 * propagate.
 *
 * Existing e2e tests are unaffected: they don't navigate to the
 * collaboration-gated routes (`/agent-questions`, `/application/:id/supervisor`),
 * and the flag enables additive code paths only.
 */
export default async function globalSetup(): Promise<void> {
  let db: ReturnType<typeof openShepDb> | null = null;
  try {
    db = openShepDb();
    setCollaborationFlag(db, true);
  } catch (err) {
    // If the DB does not yet exist (very fresh CI env), the dev server will
    // create it on boot with defaults. The supervisor / question tests will
    // skip themselves in that case via the `flagPrecondition` check.
    console.warn('[e2e global-setup] failed to enable collaboration flag:', err);
  } finally {
    db?.close();
  }
}
