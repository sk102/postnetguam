import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { previewNotice } from '@/lib/services/notice.service';

interface PreviewNoticeBody {
  template: string;
  subject?: string;
  accountId: string;
  recipientId?: string;
}

/**
 * POST /api/notices/preview - Preview a notice template with account data
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as PreviewNoticeBody;

    // Validate required fields
    if (!body.template) {
      return NextResponse.json(
        { error: 'Template is required' },
        { status: 400 }
      );
    }

    if (!body.accountId) {
      return NextResponse.json(
        { error: 'Account ID is required for preview' },
        { status: 400 }
      );
    }

    const previewRequest: {
      template: string;
      subject?: string;
      accountId: string;
      recipientId?: string;
    } = {
      template: body.template,
      accountId: body.accountId,
    };
    if (body.subject) previewRequest.subject = body.subject;
    if (body.recipientId) previewRequest.recipientId = body.recipientId;

    const preview = await previewNotice(previewRequest);

    return NextResponse.json(preview);
  } catch (error) {
    console.error('Preview notice API error:', error);
    if (error instanceof Error && error.message === 'Account not found') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
