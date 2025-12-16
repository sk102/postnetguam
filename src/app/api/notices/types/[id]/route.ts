import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import {
  getNoticeTypeById,
  updateNoticeType,
  deleteNoticeType,
} from '@/lib/services/notice.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/notices/types/[id] - Get a notice type by ID
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const noticeType = await getNoticeTypeById(id);

    if (!noticeType) {
      return NextResponse.json(
        { error: 'Notice type not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(noticeType);
  } catch (error) {
    console.error('Get notice type API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

interface UpdateNoticeTypeBody {
  name?: string;
  description?: string;
  template?: string;
  subject?: string;
  isActive?: boolean;
}

/**
 * PATCH /api/notices/types/[id] - Update a notice type
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only managers can update notice types
    if (session.user.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = (await request.json()) as UpdateNoticeTypeBody;

    const noticeType = await updateNoticeType(
      id,
      {
        name: body.name?.trim(),
        description: body.description?.trim(),
        template: body.template,
        subject: body.subject?.trim(),
        isActive: body.isActive,
      },
      session.user.id
    );

    return NextResponse.json(noticeType);
  } catch (error) {
    console.error('Update notice type API error:', error);
    if (error instanceof Error && error.message === 'Notice type not found') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/notices/types/[id] - Delete a notice type
 */
export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only managers can delete notice types
    if (session.user.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    await deleteNoticeType(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete notice type API error:', error);
    if (error instanceof Error) {
      if (error.message === 'Notice type not found') {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message === 'Cannot delete system notice types') {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
