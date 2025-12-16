import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { getNoticeHistoryById } from '@/lib/services/notice.service';
import { generateNoticePdf } from '@/lib/services/notice-pdf.service';
import { StoreSettingsService } from '@/lib/services/store-settings.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/notices/[id]/pdf - Download a notice as PDF
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

    // Get the notice history record
    const notice = await getNoticeHistoryById(id);

    if (!notice) {
      return NextResponse.json({ error: 'Notice not found' }, { status: 404 });
    }

    // Get the rendered markdown from variable snapshot
    const variableSnapshot = notice.variableSnapshot as Record<
      string,
      unknown
    > | null;
    const renderedMarkdown = variableSnapshot?.renderedMarkdown as
      | string
      | undefined;

    if (!renderedMarkdown) {
      return NextResponse.json(
        { error: 'Notice content not available for PDF generation' },
        { status: 400 }
      );
    }

    // Get the generation date
    const currentDate =
      (variableSnapshot?.currentDate as string) ||
      new Date(notice.generatedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

    // Fetch store settings from database
    const storeSettings = await StoreSettingsService.getSettings();

    // Format address from parts
    const formattedAddress = [
      storeSettings.street1,
      storeSettings.street2,
      `${storeSettings.city} ${storeSettings.zip}`,
    ]
      .filter(Boolean)
      .join(', ');

    // Generate the PDF
    const pdfBuffer = await generateNoticePdf(
      renderedMarkdown,
      storeSettings.name,
      formattedAddress,
      storeSettings.phone,
      currentDate
    );

    // Create filename
    const mailboxNumber = notice.account?.mailbox?.number ?? 'unknown';
    const noticeTypeName = notice.noticeType?.name ?? 'Notice';
    const dateStr = new Date(notice.generatedAt)
      .toISOString()
      .split('T')[0];
    const filename = `${noticeTypeName.replace(/\s+/g, '_')}_Mailbox_${mailboxNumber}_${dateStr}.pdf`;

    // Return the PDF - convert Buffer to Uint8Array for NextResponse
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Generate notice PDF API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
