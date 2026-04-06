import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { resolve } from '@/lib/server-container';
import type { ListToolsUseCase } from '@shepai/core/application/use-cases/tools/list-tools.use-case';

export async function GET(): Promise<NextResponse> {
  try {
    const useCase = resolve<ListToolsUseCase>('ListToolsUseCase');
    const tools = await useCase.execute();
    return NextResponse.json(tools);
  } catch (error: unknown) {
    return apiError(error, 500, 'Failed to list tools');
  }
}
