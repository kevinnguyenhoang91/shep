/**
 * Respond to a pending agent interaction (AskUserQuestion).
 *
 * POST - Submit user's answers to the pending interaction.
 *        The agent resumes processing after receiving the response.
 *
 * `featureId` is a polymorphic scope key: a feature UUID, "repo-<id>", or "global".
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { resolve } from '@/lib/server-container';
import type { RespondToInteractionUseCase } from '@shepai/core/application/use-cases/interactive/respond-to-interaction.use-case';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ featureId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { featureId } = await params;
    const body = (await request.json()) as {
      answers?: Record<string, string>;
    };

    if (!body.answers || typeof body.answers !== 'object') {
      return NextResponse.json({ error: 'answers must be a non-empty object' }, { status: 400 });
    }

    const useCase = resolve<RespondToInteractionUseCase>('RespondToInteractionUseCase');
    await useCase.execute({
      featureId,
      answers: body.answers,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes('No pending interaction')) {
      return apiError(error, 409, 'No pending interaction');
    }
    return apiError(error);
  }
}
