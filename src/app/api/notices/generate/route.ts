import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { generateNotices } from '@/lib/services/notice.service';
import type { NoticeDeliveryMethod } from '@prisma/client';

interface GenerateNoticesBody {
  noticeTypeId: string;
  accountIds: string[];
  deliveryMethod: NoticeDeliveryMethod;
  recipientIds?: string[];
}

/**
 * POST /api/notices/generate - Generate notices for multiple accounts
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as GenerateNoticesBody;

    // Validate required fields
    if (!body.noticeTypeId) {
      return NextResponse.json(
        { error: 'Notice type ID is required' },
        { status: 400 }
      );
    }

    if (!body.accountIds || body.accountIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one account ID is required' },
        { status: 400 }
      );
    }

    if (!body.deliveryMethod) {
      return NextResponse.json(
        { error: 'Delivery method is required' },
        { status: 400 }
      );
    }

    const validDeliveryMethods: NoticeDeliveryMethod[] = ['PRINT', 'EMAIL', 'BOTH'];
    if (!validDeliveryMethods.includes(body.deliveryMethod)) {
      return NextResponse.json(
        { error: 'Invalid delivery method' },
        { status: 400 }
      );
    }

    const result = await generateNotices(
      {
        noticeTypeId: body.noticeTypeId,
        accountIds: body.accountIds,
        deliveryMethod: body.deliveryMethod,
        recipientIds: body.recipientIds,
      },
      session.user.id
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Generate notices API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
