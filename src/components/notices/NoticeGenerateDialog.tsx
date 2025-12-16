'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  NOTICE_DELIVERY_METHOD_LABELS,
} from '@/constants/notice';
import type { SerializedNoticeType, AccountForNotice, NoticeGenerationResponse } from '@/types/notice';
import type { NoticeDeliveryMethod, NoticeTypeCode } from '@prisma/client';

// Notice types that have pre-determined filtering (don't show manual filters)
const NOTICE_TYPES_WITH_SMART_FILTERING: NoticeTypeCode[] = [
  'BIRTHDAY',
  'HOLD_NOTICE',
  'ID_VERIFICATION_REQUEST',
  'MISSING_ID',
  'RENEWAL_NOTICE',
  'UPCOMING_18TH_BIRTHDAY',
];

// Helper text for each notice type's filtering
const NOTICE_TYPE_FILTER_DESCRIPTIONS: Partial<Record<NoticeTypeCode, string>> = {
  BIRTHDAY: 'Showing accounts with recipients who have a birthday within the next 30 days',
  HOLD_NOTICE: 'Showing accounts currently on HOLD status',
  ID_VERIFICATION_REQUEST: 'Showing accounts with recipients whose ID expires within 30 days',
  MISSING_ID: 'Showing accounts with adult recipients (18+) who do not have an ID on file',
  RENEWAL_NOTICE: 'Showing accounts due for renewal within the next 30 days',
  UPCOMING_18TH_BIRTHDAY: 'Showing accounts with minors turning 18 within the next 30 days',
};

interface NoticeGenerateDialogProps {
  noticeType: SerializedNoticeType | null;
  isOpen: boolean;
  onClose: () => void;
  onGenerated: () => void;
}

export function NoticeGenerateDialog({
  noticeType,
  isOpen,
  onClose,
  onGenerated,
}: NoticeGenerateDialogProps): React.ReactElement | null {
  const [accounts, setAccounts] = useState<AccountForNotice[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [deliveryMethod, setDeliveryMethod] = useState<NoticeDeliveryMethod>('PRINT');
  const [loading, setLoading] = useState(false);
  const [loadingAllIds, setLoadingAllIds] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<NoticeGenerationResponse | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [renewalDueSoon, setRenewalDueSoon] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAccounts, setTotalAccounts] = useState(0);

  // Check if this notice type has smart filtering
  const hasSmartFiltering = noticeType
    ? NOTICE_TYPES_WITH_SMART_FILTERING.includes(noticeType.code)
    : false;

  const filterDescription = noticeType
    ? NOTICE_TYPE_FILTER_DESCRIPTIONS[noticeType.code]
    : undefined;

  const fetchAccounts = useCallback(async (): Promise<void> => {
    if (!noticeType) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '20',
      });

      // Always pass the notice type code for smart filtering
      params.set('noticeTypeCode', noticeType.code);

      // Only apply manual filters if no smart filtering
      if (!hasSmartFiltering) {
        if (search) params.set('search', search);
        if (statusFilter) params.set('status', statusFilter);
        if (renewalDueSoon) params.set('renewalDueSoon', 'true');
      } else {
        // With smart filtering, only allow search
        if (search) params.set('search', search);
      }

      const response = await fetch(`/api/notices/accounts?${params}`);
      if (response.ok) {
        const data = await response.json();
        setAccounts(data.data);
        setTotalPages(data.pagination.totalPages);
        setTotalAccounts(data.pagination.total);
      }
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, renewalDueSoon, noticeType, hasSmartFiltering]);

  useEffect(() => {
    if (isOpen) {
      void fetchAccounts();
    }
  }, [isOpen, fetchAccounts]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setSelectedAccountIds(new Set());
      setResult(null);
      setPage(1);
    }
  }, [isOpen]);

  const toggleAccount = (accountId: string): void => {
    setSelectedAccountIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(accountId)) {
        newSet.delete(accountId);
      } else {
        newSet.add(accountId);
      }
      return newSet;
    });
  };

  // Fetch all account IDs for Select All functionality
  const selectAll = async (): Promise<void> => {
    if (!noticeType) return;

    setLoadingAllIds(true);
    try {
      const params = new URLSearchParams({
        idsOnly: 'true',
      });

      // Pass the same filters
      params.set('noticeTypeCode', noticeType.code);
      if (!hasSmartFiltering) {
        if (search) params.set('search', search);
        if (statusFilter) params.set('status', statusFilter);
        if (renewalDueSoon) params.set('renewalDueSoon', 'true');
      } else {
        if (search) params.set('search', search);
      }

      const response = await fetch(`/api/notices/accounts?${params}`);
      if (response.ok) {
        const data = await response.json() as { ids: string[]; total: number };
        setSelectedAccountIds(new Set(data.ids));
      }
    } catch (err) {
      console.error('Failed to fetch all account IDs:', err);
      // Fallback to selecting current page only
      setSelectedAccountIds(new Set(accounts.map((a) => a.id)));
    } finally {
      setLoadingAllIds(false);
    }
  };

  const deselectAll = (): void => {
    setSelectedAccountIds(new Set());
  };

  const handleGenerate = async (): Promise<void> => {
    if (!noticeType || selectedAccountIds.size === 0) return;

    setGenerating(true);
    setResult(null);

    try {
      const response = await fetch('/api/notices/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noticeTypeId: noticeType.id,
          accountIds: Array.from(selectedAccountIds),
          deliveryMethod,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate notices');
      }

      const data = (await response.json()) as NoticeGenerationResponse;
      setResult(data);

      if (data.successful > 0) {
        onGenerated();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to generate notices');
    } finally {
      setGenerating(false);
    }
  };

  if (!isOpen || !noticeType) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-xl font-semibold text-postnet-charcoal">
              Generate Notices
            </h2>
            <p className="text-sm text-gray-500">
              {noticeType.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {result ? (
            // Results view
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-postnet-charcoal">
                    {result.totalRequested}
                  </p>
                  <p className="text-sm text-gray-500">Requested</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {result.successful}
                  </p>
                  <p className="text-sm text-green-600">Successful</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-red-600">
                    {result.failed}
                  </p>
                  <p className="text-sm text-red-600">Failed</p>
                </div>
              </div>

              {result.failed > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-red-50 px-4 py-2 border-b">
                    <p className="text-sm font-medium text-red-800">Failed Notices</p>
                  </div>
                  <div className="divide-y max-h-48 overflow-y-auto">
                    {result.results
                      .filter((r) => !r.success)
                      .map((r) => (
                        <div key={r.accountId} className="px-4 py-2 text-sm">
                          <span className="font-medium">Box #{r.mailboxNumber}</span>
                          <span className="text-red-600 ml-2">{r.error}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Selection view
            <>
              {/* Filter description for smart filtering */}
              {filterDescription && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                  <p className="text-sm text-blue-800">{filterDescription}</p>
                </div>
              )}

              {/* Filters */}
              <div className="flex gap-4 flex-wrap">
                <input
                  type="text"
                  placeholder="Search by mailbox # or name..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="flex-1 min-w-48 px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                {/* Only show manual filters for CUSTOM notice type */}
                {!hasSmartFiltering && (
                  <>
                    <select
                      value={statusFilter}
                      onChange={(e) => {
                        setStatusFilter(e.target.value);
                        setPage(1);
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="">All Statuses</option>
                      <option value="ACTIVE">Active</option>
                      <option value="HOLD">On Hold</option>
                    </select>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={renewalDueSoon}
                        onChange={(e) => {
                          setRenewalDueSoon(e.target.checked);
                          setPage(1);
                        }}
                        className="rounded text-postnet-red focus:ring-postnet-red"
                      />
                      Renewal due within 30 days
                    </label>
                  </>
                )}
              </div>

              {/* Delivery Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery Method
                </label>
                <select
                  value={deliveryMethod}
                  onChange={(e) => setDeliveryMethod(e.target.value as NoticeDeliveryMethod)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  {(['PRINT', 'EMAIL', 'BOTH'] as NoticeDeliveryMethod[]).map((method) => (
                    <option key={method} value={method}>
                      {NOTICE_DELIVERY_METHOD_LABELS[method]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Account Selection */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {selectedAccountIds.size} account(s) selected
                  {totalAccounts > 0 && selectedAccountIds.size !== totalAccounts && (
                    <span className="text-gray-400"> of {totalAccounts}</span>
                  )}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void selectAll()}
                    disabled={loadingAllIds}
                    className="text-sm text-postnet-red hover:underline disabled:opacity-50"
                  >
                    {loadingAllIds ? 'Loading...' : 'Select All'}
                  </button>
                  <button
                    type="button"
                    onClick={deselectAll}
                    className="text-sm text-gray-500 hover:underline"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Accounts List */}
              <div className="border rounded-lg overflow-hidden">
                {loading ? (
                  <div className="p-8 text-center text-gray-500">Loading...</div>
                ) : accounts.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">No accounts found</div>
                ) : (
                  <div className="divide-y max-h-64 overflow-y-auto">
                    {accounts.map((account) => (
                      <label
                        key={account.id}
                        className="flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedAccountIds.has(account.id)}
                          onChange={() => toggleAccount(account.id)}
                          className="h-4 w-4 text-postnet-red focus:ring-postnet-red border-gray-300 rounded"
                        />
                        <div className="ml-3 flex-1">
                          <span className="font-medium text-postnet-charcoal">
                            Box #{account.mailboxNumber}
                          </span>
                          <span className="text-gray-500 ml-2">
                            {account.primaryRecipient?.displayName ?? 'No recipient'}
                          </span>
                        </div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            account.status === 'ACTIVE'
                              ? 'bg-green-100 text-green-800'
                              : account.status === 'HOLD'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {account.status}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-gray-500">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
          {result ? (
            <Button onClick={onClose}>Close</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={() => void handleGenerate()}
                disabled={generating || selectedAccountIds.size === 0}
              >
                {generating
                  ? 'Generating...'
                  : `Generate ${selectedAccountIds.size} Notice(s)`}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
