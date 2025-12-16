'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSelectedMailboxes } from '@/lib/hooks/useSelectedMailboxes';

interface LabelRecipient {
  displayName: string;
  type: 'PERSON' | 'BUSINESS';
  age: number | null;
  isAdult: boolean;
  isPrimary: boolean;
}

interface MailboxLabel {
  mailboxId: string;
  mailboxNumber: number;
  primaryRecipient: string | null;
  recipients: LabelRecipient[];
}

const LABELS_PER_PAGE = 15;
const COLUMNS = 3;
const ROWS = 5;

function RecipientItem({ recipient }: { recipient: LabelRecipient }): React.ReactElement {
  if (recipient.type === 'BUSINESS') {
    return <span className="text-blue-700">{recipient.displayName}</span>;
  }
  return (
    <span>
      {recipient.displayName}
      {!recipient.isAdult && recipient.age !== null && (
        <span className="text-gray-500 font-normal ml-1">({recipient.age})</span>
      )}
    </span>
  );
}

function MailboxLabel({ label }: { label: MailboxLabel | null }): React.ReactElement {
  if (!label) {
    // Empty label cell - maintain structure
    return (
      <div className="label-cell border border-gray-300 font-sans">
        <div className="h-full" />
      </div>
    );
  }

  // Filter out primary from the recipient list to avoid duplication
  const otherRecipients = label.recipients.filter((r) => !r.isPrimary);
  const count = otherRecipients.length;

  // Determine layout based on recipient count
  // 0-4: normal size single column
  // 5-7: smaller font single column
  // 8+: two columns with smallest font
  const useSmallFont = count >= 5;
  const useTwoColumns = count >= 8;

  // For two columns, split recipients into left and right
  const midpoint = Math.ceil(count / 2);
  const leftColumn = useTwoColumns ? otherRecipients.slice(0, midpoint) : [];
  const rightColumn = useTwoColumns ? otherRecipients.slice(midpoint) : [];

  // Font size classes
  const fontSizeClass = useTwoColumns
    ? 'text-[9px] leading-tight'
    : useSmallFont
      ? 'text-[10px] leading-tight'
      : 'text-xs leading-snug';

  return (
    <div className="label-cell border border-gray-300 flex flex-col font-sans">
      {/* Row 1: Mailbox number and primary recipient */}
      <div className="flex border-b border-gray-200">
        <div className="w-1/3 p-3 flex items-center justify-center border-r border-gray-200">
          <span className="text-3xl font-bold">
            {label.mailboxNumber}
          </span>
        </div>
        <div className="w-2/3 p-3 flex items-center justify-center">
          {label.primaryRecipient && (
            <span className="text-xs font-bold text-center leading-tight">
              {label.primaryRecipient}
            </span>
          )}
        </div>
      </div>

      {/* Row 2: Recipient list (vertically centered) */}
      <div className="flex-1 p-2 flex items-center justify-center overflow-hidden">
        {useTwoColumns ? (
          // Two column layout for many recipients
          <div className={`${fontSizeClass} font-bold w-full flex gap-2`}>
            <div className="flex-1 space-y-0 text-center">
              {leftColumn.map((recipient, idx) => (
                <div key={idx} className="truncate">
                  <RecipientItem recipient={recipient} />
                </div>
              ))}
            </div>
            <div className="flex-1 space-y-0 text-center">
              {rightColumn.map((recipient, idx) => (
                <div key={idx} className="truncate">
                  <RecipientItem recipient={recipient} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Single column layout
          <div className={`${fontSizeClass} font-bold space-y-0.5 text-center`}>
            {otherRecipients.map((recipient, idx) => (
              <div key={idx} className="truncate">
                <RecipientItem recipient={recipient} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PrintLabelsContent(): React.ReactElement {
  const { selectedMailboxes, clearAll, count, isLoaded } = useSelectedMailboxes();
  const [labels, setLabels] = useState<MailboxLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLabels = useCallback(async (): Promise<void> => {
    if (!isLoaded) {
      return;
    }

    if (selectedMailboxes.length === 0) {
      setLabels([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/mailboxes/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mailboxIds: selectedMailboxes.map((m) => m.id),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch label data');
      }

      const data = await response.json();
      setLabels(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [selectedMailboxes, isLoaded]);

  useEffect(() => {
    void fetchLabels();
  }, [fetchLabels]);

  const handlePrint = (): void => {
    window.print();
  };

  // Split labels into pages of 15
  const pages: (MailboxLabel | null)[][] = [];
  for (let i = 0; i < labels.length; i += LABELS_PER_PAGE) {
    const pageLabels: (MailboxLabel | null)[] = labels.slice(i, i + LABELS_PER_PAGE);
    // Pad to 15 labels per page
    while (pageLabels.length < LABELS_PER_PAGE) {
      pageLabels.push(null);
    }
    pages.push(pageLabels);
  }

  // If no labels, still show one empty page
  if (pages.length === 0) {
    const emptyPage: (MailboxLabel | null)[] = Array(LABELS_PER_PAGE).fill(null);
    pages.push(emptyPage);
  }

  // Wait for localStorage to load before showing "no selection" message
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <span className="text-gray-500">Loading...</span>
      </div>
    );
  }

  if (count === 0) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">No Mailboxes Selected</h1>
          <p className="text-gray-600 mb-6">
            Please select mailboxes from the mailboxes list to print labels.
          </p>
          <Link
            href="/mailboxes"
            className="inline-block rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Go to Mailboxes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Screen controls - hidden when printing */}
      <div className="print:hidden bg-gray-100 p-4 sticky top-0 z-10 border-b">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/mailboxes"
              className="text-blue-600 hover:text-blue-800"
            >
              ← Back to Mailboxes
            </Link>
            <span className="text-gray-600">
              {count} label{count !== 1 ? 's' : ''} selected
              ({pages.length} page{pages.length !== 1 ? 's' : ''})
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={clearAll}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Clear Selection
            </button>
            <button
              onClick={handlePrint}
              disabled={loading}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Print Labels
            </button>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="print:hidden flex items-center justify-center py-12">
          <span className="text-gray-500">Loading label data...</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="print:hidden max-w-2xl mx-auto p-4">
          <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
            {error}
          </div>
        </div>
      )}

      {/* Label pages */}
      {!loading && !error && (
        <div className="print-container">
          {pages.map((pageLabels, pageIndex) => (
            <div key={pageIndex} className="label-page">
              <div className="label-grid">
                {pageLabels.map((label, idx) => (
                  <MailboxLabel key={idx} label={label} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          @page {
            size: letter;
            margin: 0.5in;
          }

          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .print\\:hidden {
            display: none !important;
          }

          .print-container {
            margin: 0;
            padding: 0;
          }

          .label-page {
            page-break-after: always;
            width: 7.5in;
            height: 10in;
          }

          .label-page:last-child {
            page-break-after: avoid;
          }

          .label-grid {
            display: grid;
            grid-template-columns: repeat(${COLUMNS}, 1fr);
            grid-template-rows: repeat(${ROWS}, 1fr);
            width: 100%;
            height: 100%;
            gap: 0;
          }

          .label-cell {
            width: 2.5in;
            height: 2in;
            box-sizing: border-box;
          }
        }

        @media screen {
          .print-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2rem;
            padding: 2rem;
            background: #f3f4f6;
          }

          .label-page {
            width: 7.5in;
            height: 10in;
            background: white;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            padding: 0;
          }

          .label-grid {
            display: grid;
            grid-template-columns: repeat(${COLUMNS}, 1fr);
            grid-template-rows: repeat(${ROWS}, 1fr);
            width: 100%;
            height: 100%;
            gap: 0;
          }

          .label-cell {
            height: 2in;
            box-sizing: border-box;
          }
        }
      `}</style>
    </>
  );
}

export default function PrintLabelsPage(): React.ReactElement {
  return <PrintLabelsContent />;
}
