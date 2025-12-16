'use client';

import { useEffect, useState, useCallback } from 'react';
import { AppLayout } from '@/components/layout';
import { PaymentHistoryTable } from '@/components/payments/PaymentHistoryTable';
import { PaymentFilters } from '@/components/payments/PaymentFilters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { PaymentWithDetails, PaginatedPaymentResponse } from '@/types/payment';

function PaymentsPageContent(): React.ReactElement {
  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });

      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (paymentMethod && paymentMethod !== 'ALL') params.set('paymentMethod', paymentMethod);

      const res = await fetch(`/api/payments?${params}`);
      if (!res.ok) {
        throw new Error('Failed to fetch payments');
      }

      const data = await res.json() as PaginatedPaymentResponse;
      setPayments(data.data);
      setTotalPages(data.pagination.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [page, startDate, endDate, paymentMethod]);

  useEffect(() => {
    void fetchPayments();
  }, [fetchPayments]);

  const clearFilters = (): void => {
    setStartDate('');
    setEndDate('');
    setPaymentMethod('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <PaymentFilters
              startDate={startDate}
              endDate={endDate}
              paymentMethod={paymentMethod}
              onStartDateChange={(v) => { setStartDate(v); setPage(1); }}
              onEndDateChange={(v) => { setEndDate(v); setPage(1); }}
              onPaymentMethodChange={(v) => { setPaymentMethod(v); setPage(1); }}
              onClear={clearFilters}
            />
          </div>

          {error && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <PaymentHistoryTable
            payments={payments}
            showAccount={true}
            loading={loading}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between border-t pt-4">
              <div className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || loading}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function PaymentsPage(): React.ReactElement {
  return (
    <AppLayout>
      <PaymentsPageContent />
    </AppLayout>
  );
}
