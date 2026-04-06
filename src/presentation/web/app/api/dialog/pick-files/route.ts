import { NextResponse } from 'next/server';
import {
  FileDialogService,
  type FileAttachment,
} from '@shepai/core/infrastructure/services/file-dialog.service';

export async function POST(): Promise<NextResponse> {
  const service = new FileDialogService();

  try {
    const files: FileAttachment[] | null = service.pickFiles();
    return NextResponse.json({ files, cancelled: files === null });
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error('[API Error]', error);
    return NextResponse.json(
      { files: null, cancelled: false, error: 'Failed to open file dialog' },
      { status: 500 }
    );
  }
}
