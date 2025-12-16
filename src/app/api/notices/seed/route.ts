import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { seedDefaultNoticeTypes } from '@/lib/services/notice.service';

/**
 * POST /api/notices/seed - Seed default notice types
 * Only managers can seed notice types
 */
export async function POST(): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only managers can seed notice types
    if (session.user.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await seedDefaultNoticeTypes(session.user.id);

    return NextResponse.json({
      success: true,
      message: 'Default notice types have been seeded',
    });
  } catch (error) {
    console.error('Seed notice types API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
