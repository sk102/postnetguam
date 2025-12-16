import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { getNoticeHistory } from '@/lib/services/notice.service';
import type { NoticeDeliveryMethod, NoticeStatus } from '@prisma/client';

/**
 * GET /api/notices/history - List notice history with filtering
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;

    // Parse filter parameters - build object with only defined values
    const filter: {
      noticeTypeId?: string;
      accountId?: string;
      status?: NoticeStatus;
      deliveryMethod?: NoticeDeliveryMethod;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
    } = {};

    const noticeTypeId = searchParams.get('noticeTypeId');
    const accountId = searchParams.get('accountId');
    const status = searchParams.get('status');
    const deliveryMethod = searchParams.get('deliveryMethod');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const search = searchParams.get('search');

    if (noticeTypeId) filter.noticeTypeId = noticeTypeId;
    if (accountId) filter.accountId = accountId;
    if (status) filter.status = status as NoticeStatus;
    if (deliveryMethod) filter.deliveryMethod = deliveryMethod as NoticeDeliveryMethod;
    if (dateFrom) filter.dateFrom = dateFrom;
    if (dateTo) filter.dateTo = dateTo;
    if (search) filter.search = search;

    // Parse pagination
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('pageSize') ?? '50', 10))
    );

    const result = await getNoticeHistory(filter, page, pageSize);

    return NextResponse.json({
      data: result.notices,
      pagination: {
        page,
        pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / pageSize),
      },
    });
  } catch (error) {
    console.error('Notice history list API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
