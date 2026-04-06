import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { resolve } from '@/lib/server-container';
import type {
  LaunchToolUseCase,
  LaunchToolResult,
} from '@shepai/core/application/use-cases/tools/launch-tool.use-case';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  try {
    const useCase = resolve<LaunchToolUseCase>('LaunchToolUseCase');
    const result: LaunchToolResult = await useCase.execute({
      toolId: id,
      directoryPath: process.env.NEXT_PUBLIC_SHEP_INSTANCE_PATH ?? process.cwd(),
      headless: true,
    });

    if (result.ok) {
      return NextResponse.json({ editorName: result.editorName, path: result.path });
    }

    switch (result.code) {
      case 'tool_not_found':
        return NextResponse.json({ error: 'Tool not found' }, { status: 404 });
      case 'not_launchable':
        return NextResponse.json({ error: 'Tool has no openDirectory command' }, { status: 422 });
      case 'launch_failed':
        return NextResponse.json({ error: result.message }, { status: 500 });
    }
  } catch (error: unknown) {
    return apiError(error, 500, 'Failed to launch tool');
  }
}
