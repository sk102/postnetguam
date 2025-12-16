'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  NOTICE_STATUS_LABELS,
  NOTICE_STATUS_COLORS,
  NOTICE_DELIVERY_METHOD_LABELS,
} from '@/constants/notice';
import type { SerializedNoticeHistory } from '@/types/notice';
import type { NoticeStatus, NoticeDeliveryMethod } from '@prisma/client';

interface NoticeHistoryTableProps {
  isManager: boolean;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function NoticeHistoryTable({
  isManager,
}: NoticeHistoryTableProps): React.ReactElement {
  const [notices, setNotices] = useState<SerializedNoticeHistory[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<NoticeStatus | ''>('');
  const [deliveryFilter, setDeliveryFilter] = useState<
    NoticeDeliveryMethod | ''
  >('');

  const fetchHistory = useCallback(async (page: number): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '20',
      });
      if (statusFilter) params.set('status', statusFilter);
      if (deliveryFilter) params.set('deliveryMethod', deliveryFilter);

      const response = await fetch(`/api/notices/history?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch notice history');
      }

      const data = await response.json();
      setNotices(data.data);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, deliveryFilter]);

  useEffect(() => {
    void fetchHistory(1);
  }, [fetchHistory]);

  const handleDownloadPdf = async (noticeId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/notices/${noticeId}/pdf`);
      if (!response.ok) {
        throw new Error('Failed to download PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') ??
        'notice.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to download PDF');
    }
  };

  const handleDelete = async (noticeId: string): Promise<void> => {
    if (!confirm('Are you sure you want to delete this notice record?')) return;

    try {
      const response = await fetch(`/api/notices/${noticeId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete notice');
      }
      void fetchHistory(pagination.page);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete notice');
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as NoticeStatus | '')}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          <option value="">All Statuses</option>
          {(['GENERATED', 'SENT', 'FAILED'] as NoticeStatus[]).map((status) => (
            <option key={status} value={status}>
              {NOTICE_STATUS_LABELS[status]}
            </option>
          ))}
        </select>

        <select
          value={deliveryFilter}
          onChange={(e) =>
            setDeliveryFilter(e.target.value as NoticeDeliveryMethod | '')
          }
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          <option value="">All Delivery Methods</option>
          {(['PRINT', 'EMAIL', 'BOTH'] as NoticeDeliveryMethod[]).map(
            (method) => (
              <option key={method} value={method}>
                {NOTICE_DELIVERY_METHOD_LABELS[method]}
              </option>
            )
          )}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-postnet-charcoal uppercase">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-postnet-charcoal uppercase">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-postnet-charcoal uppercase">
                Mailbox
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-postnet-charcoal uppercase">
                Recipient
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-postnet-charcoal uppercase">
                Delivery
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-postnet-charcoal uppercase">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-postnet-charcoal uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : notices.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No notice history found
                </td>
              </tr>
            ) : (
              notices.map((notice) => (
                <tr key={notice.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDate(notice.generatedAt)}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-postnet-charcoal">
                    {notice.noticeType?.name ?? 'Unknown'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    #{notice.account?.mailbox?.number ?? 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {notice.recipient
                      ? notice.recipient.businessName ??
                        `${notice.recipient.firstName ?? ''} ${notice.recipient.lastName ?? ''}`.trim()
                      : 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {NOTICE_DELIVERY_METHOD_LABELS[notice.deliveryMethod]}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                        NOTICE_STATUS_COLORS[notice.status]
                      }`}
                    >
                      {NOTICE_STATUS_LABELS[notice.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleDownloadPdf(notice.id)}
                      >
                        PDF
                      </Button>
                      {isManager && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleDelete(notice.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Showing {(pagination.page - 1) * pagination.pageSize + 1} to{' '}
            {Math.min(pagination.page * pagination.pageSize, pagination.total)}{' '}
            of {pagination.total} notices
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchHistory(pagination.page - 1)}
              disabled={pagination.page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchHistory(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
