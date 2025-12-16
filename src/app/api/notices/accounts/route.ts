import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { getAccountsForNoticeSelection } from '@/lib/services/notice.service';
import type { NoticeTypeCode } from '@prisma/client';

// Valid notice type codes for validation
const VALID_NOTICE_TYPE_CODES: NoticeTypeCode[] = [
  'RENEWAL_NOTICE',
  'UPCOMING_18TH_BIRTHDAY',
  'BIRTHDAY',
  'HOLD_NOTICE',
  'ID_VERIFICATION_REQUEST',
  'MISSING_ID',
  'CUSTOM',
];

/**
 * GET /api/notices/accounts - Get accounts for notice generation selection
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;

    // Parse filter parameters
    const status = searchParams.get('status') ?? undefined;
    const renewalDueSoon = searchParams.get('renewalDueSoon') === 'true';
    const search = searchParams.get('search') ?? undefined;
    const noticeTypeCodeParam = searchParams.get('noticeTypeCode');

    // Validate notice type code if provided
    const noticeTypeCode =
      noticeTypeCodeParam &&
      VALID_NOTICE_TYPE_CODES.includes(noticeTypeCodeParam as NoticeTypeCode)
        ? (noticeTypeCodeParam as NoticeTypeCode)
        : undefined;

    // Parse pagination
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('pageSize') ?? '50', 10))
    );

    const filter: {
      status?: string;
      renewalDueSoon?: boolean;
      search?: string;
      noticeTypeCode?: NoticeTypeCode;
    } = {};
    if (status) filter.status = status;
    if (renewalDueSoon) filter.renewalDueSoon = renewalDueSoon;
    if (search) filter.search = search;
    if (noticeTypeCode) filter.noticeTypeCode = noticeTypeCode;

    const result = await getAccountsForNoticeSelection(
      filter,
      page,
      pageSize
    );

    return NextResponse.json({
      data: result.accounts,
      pagination: {
        page,
        pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / pageSize),
      },
    });
  } catch (error) {
    console.error('Notice accounts list API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
