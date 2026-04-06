/**
 * Feature-scoped stop API — kills the active agent session.
 *
 * `featureId` is a polymorphic scope key: a feature UUID, "repo-<id>", or "global".
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { resolve } from '@/lib/server-container';
import type { StopInteractiveSessionUseCase } from '@shepai/core/application/use-cases/interactive/stop-interactive-session.use-case';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ featureId: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { featureId } = await params;
    const useCase = resolve<StopInteractiveSessionUseCase>('StopInteractiveSessionUseCase');
    await useCase.execute({ featureId });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
