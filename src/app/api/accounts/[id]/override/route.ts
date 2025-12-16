import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { AuditService } from '@/lib/services/audit.service';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

const setOverrideSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500),
});

/**
 * POST /api/accounts/[id]/override - Set rate override (MANAGER only)
 * DELETE /api/accounts/[id]/override - Clear rate override (MANAGER only)
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only MANAGER can set overrides
    if (session.user.role !== 'MANAGER') {
      return NextResponse.json(
        { error: 'Only managers can approve rate overrides' },
        { status: 403 }
      );
    }

    const { id: accountId } = await params;

    // Verify account exists
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = setOverrideSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    await AuditService.setRateOverride(
      accountId,
      session.user.id,
      validation.data.reason
    );

    return NextResponse.json({
      message: 'Rate override set successfully',
    });
  } catch (error) {
    console.error('Set override error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only MANAGER can clear overrides
    if (session.user.role !== 'MANAGER') {
      return NextResponse.json(
        { error: 'Only managers can clear rate overrides' },
        { status: 403 }
      );
    }

    const { id: accountId } = await params;

    // Verify account exists
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    await AuditService.clearRateOverride(accountId);

    return NextResponse.json({
      message: 'Rate override cleared',
    });
  } catch (error) {
    console.error('Clear override error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
