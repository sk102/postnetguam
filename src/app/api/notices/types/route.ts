import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import {
  getAllNoticeTypes,
  createNoticeType,
} from '@/lib/services/notice.service';
import type { NoticeTypeCode } from '@prisma/client';

/**
 * GET /api/notices/types - List all notice types
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const noticeTypes = await getAllNoticeTypes(includeInactive);

    // Cache notice types for 5 minutes (they rarely change)
    return NextResponse.json(
      { data: noticeTypes },
      {
        headers: {
          'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (error) {
    console.error('Notice types list API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

interface CreateNoticeTypeBody {
  code: NoticeTypeCode;
  name: string;
  description?: string;
  template: string;
  subject?: string;
  isActive?: boolean;
}

/**
 * POST /api/notices/types - Create a new notice type
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only managers can create notice types
    if (session.user.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json()) as CreateNoticeTypeBody;

    // Validate required fields
    if (!body.code) {
      return NextResponse.json(
        { error: 'Notice type code is required' },
        { status: 400 }
      );
    }

    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: 'Notice type name is required' },
        { status: 400 }
      );
    }

    if (!body.template?.trim()) {
      return NextResponse.json(
        { error: 'Template is required' },
        { status: 400 }
      );
    }

    const noticeType = await createNoticeType(
      {
        code: body.code,
        name: body.name.trim(),
        description: body.description?.trim(),
        template: body.template,
        subject: body.subject?.trim(),
        isActive: body.isActive,
      },
      session.user.id
    );

    return NextResponse.json(noticeType, { status: 201 });
  } catch (error) {
    console.error('Create notice type API error:', error);
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'A notice type with this code already exists' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
