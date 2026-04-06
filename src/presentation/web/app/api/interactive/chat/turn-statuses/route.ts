/**
 * Bulk turn-status API.
 *
 * GET /api/interactive/chat/turn-statuses
 *
 * Returns ALL non-idle turn statuses as { featureId: turnStatus }.
 * No parameters needed — the backend knows which sessions are active.
 */

import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { resolve } from '@/lib/server-container';
import type { IInteractiveSessionService } from '@shepai/core/application/ports/output/services/interactive-session-service.interface';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    const service = resolve<IInteractiveSessionService>('IInteractiveSessionService');
    const statuses = await service.getAllActiveTurnStatuses();

    // Convert Map to plain object for JSON serialization
    const result: Record<string, string> = {};
    for (const [id, status] of statuses) {
      result[id] = status;
    }

    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
