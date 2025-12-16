import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { AuditService } from '@/lib/services/audit.service';

/**
 * GET /api/audit - Get flagged accounts
 * POST /api/audit - Run audit (MANAGER only)
 * PUT /api/audit - Recalculate account rates (MANAGER only)
 * DELETE /api/audit - Clear all audit data (MANAGER only)
 */

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') ?? 'flagged';

    // Always fetch summary stats
    const summary = await AuditService.getSummary();

    // Fetch accounts based on view type
    let accounts;
    if (view === 'override') {
      accounts = await AuditService.getAccountsWithOverride();
    } else {
      accounts = await AuditService.getFlaggedAccounts();
    }

    return NextResponse.json({
      data: accounts,
      count: accounts.length,
      summary,
    });
  } catch (error) {
    console.error('Audit GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only MANAGER can trigger audits
    if (session.user.role !== 'MANAGER') {
      return NextResponse.json(
        { error: 'Only managers can run audits' },
        { status: 403 }
      );
    }

    // Parse optional status filter from request body
    let statusFilter: ('ACTIVE' | 'HOLD')[] | undefined;
    try {
      const body = await request.json();
      if (body.statuses && Array.isArray(body.statuses)) {
        statusFilter = body.statuses;
      }
    } catch {
      // No body or invalid JSON - use defaults
    }

    const summary = await AuditService.runRateAudit(statusFilter);

    return NextResponse.json({
      message: 'Audit completed',
      summary: {
        totalAccounts: summary.totalAccounts,
        accountsAudited: summary.accountsAudited,
        accountsFlagged: summary.accountsFlagged,
        accountsWithOverride: summary.accountsWithOverride,
        accountsOk: summary.accountsOk,
      },
      flaggedAccounts: summary.results.filter((r) => r.auditFlag),
    });
  } catch (error) {
    console.error('Audit POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only MANAGER can recalculate rates
    if (session.user.role !== 'MANAGER') {
      return NextResponse.json(
        { error: 'Only managers can recalculate rates' },
        { status: 403 }
      );
    }

    // Parse optional autoUpdate flag from request body
    let autoUpdate = false;
    try {
      const body = await request.json();
      if (body.autoUpdate === true) {
        autoUpdate = true;
      }
    } catch {
      // No body or invalid JSON - use defaults
    }

    const result = await AuditService.recalculateAccountRates(autoUpdate);

    return NextResponse.json({
      message: autoUpdate ? 'Rates recalculated and updated' : 'Rate check completed',
      accountsChecked: result.accountsChecked,
      accountsNeedingUpdate: result.accountsNeedingUpdate,
      accountsUpdated: result.accountsUpdated,
      updates: result.updates,
    });
  } catch (error) {
    console.error('Audit PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only MANAGER can clear audit data
    if (session.user.role !== 'MANAGER') {
      return NextResponse.json(
        { error: 'Only managers can clear audit data' },
        { status: 403 }
      );
    }

    const count = await AuditService.clearAllAuditData();

    return NextResponse.json({
      message: 'Audit data cleared',
      accountsCleared: count,
    });
  } catch (error) {
    console.error('Audit DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
