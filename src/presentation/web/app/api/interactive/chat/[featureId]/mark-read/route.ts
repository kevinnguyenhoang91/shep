/**
 * Mark chat as read API.
 *
 * POST /api/interactive/chat/[featureId]/mark-read
 *
 * Clears the 'unread' turn status to 'idle'. Called when the user
 * opens/views the chat tab for a feature.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { resolve } from '@/lib/server-container';
import type { IInteractiveSessionService } from '@shepai/core/application/ports/output/services/interactive-session-service.interface';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ featureId: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { featureId } = await params;
    const service = resolve<IInteractiveSessionService>('IInteractiveSessionService');
    await service.markRead(featureId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
