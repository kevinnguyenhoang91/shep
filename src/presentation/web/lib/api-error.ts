import { NextResponse } from 'next/server';

/**
 * Create a sanitized error response. Logs full error server-side,
 * returns only a safe message to the client.
 */
export function apiError(error: unknown, status = 500, publicMessage?: string): NextResponse {
  // eslint-disable-next-line no-console
  console.error('[API Error]', error);

  const message =
    publicMessage ?? (error instanceof Error ? error.message : 'Internal server error');

  return NextResponse.json({ error: message }, { status });
}
