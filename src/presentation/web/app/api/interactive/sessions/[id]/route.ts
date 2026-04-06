/**
 * /api/interactive/sessions/[id]
 *
 * DELETE - Stop an active interactive session. Idempotent.
 * GET    - Retrieve session record by ID.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { resolve } from '@/lib/server-container';
import type { IInteractiveSessionService } from '@shepai/core/application/ports/output/services/interactive-session-service.interface';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const service = resolve<IInteractiveSessionService>('IInteractiveSessionService');

    // Verify session exists
    const session = await service.getSession(id);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    await service.stopSession(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}

export async function GET(_request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { id } = await params;
    const service = resolve<IInteractiveSessionService>('IInteractiveSessionService');
    const session = await service.getSession(id);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json(session);
  } catch (error) {
    return apiError(error);
  }
}
