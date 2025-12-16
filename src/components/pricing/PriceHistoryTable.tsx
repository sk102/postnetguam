'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { SerializedPriceConfig } from '@/types/pricing';
import { PRICING } from '@/constants/app';

interface PaginatedResponse {
  success: boolean;
  data: SerializedPriceConfig[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function PriceHistoryTable(): React.ReactElement {
  const [history, setHistory] = useState<SerializedPriceConfig[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/pricing/history?page=${page}&limit=10`);

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('You do not have permission to view pricing history');
        }
        throw new Error('Failed to fetch pricing history');
      }

      const data = await response.json() as PaginatedResponse;
      setHistory(data.data);
      setTotalPages(data.pagination.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pricing History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pricing History</CardTitle>
        <CardDescription>
          View all previous pricing configurations
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No pricing history available
          </p>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {history.map((config) => {
                const monthlyRate = config.baseRate3mo / PRICING.PERIOD_MONTHS.THREE_MONTH;
                return (
                  <div key={config.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{formatDate(config.startDate)}</span>
                      {config.endDate ? (
                        <span className="text-sm text-muted-foreground">→ {formatDate(config.endDate)}</span>
                      ) : (
                        <span className="text-sm text-green-600 font-medium">Current</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Base: </span>
                        <span className="font-mono">{formatCurrency(monthlyRate)}/mo</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Business: </span>
                        <span className="font-mono">{formatCurrency(config.businessAccountFee)}/mo</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Add&apos;l: </span>
                        <span className="font-mono">{formatCurrency(config.rate4thAdult)}/mo</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Minor: </span>
                        <span className="font-mono">{formatCurrency(config.minorRecipientFee)}/mo</span>
                      </div>
                    </div>
                    {config.notes && (
                      <p className="text-xs text-muted-foreground pt-2 border-t">{config.notes}</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <Table className="hidden md:table">
              <TableHeader>
                <TableRow>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Base Rate</TableHead>
                  <TableHead>Business Fee</TableHead>
                  <TableHead>Additional</TableHead>
                  <TableHead>Minor Fee</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((config) => {
                  const monthlyRate = config.baseRate3mo / PRICING.PERIOD_MONTHS.THREE_MONTH;
                  return (
                    <TableRow key={config.id}>
                      <TableCell className="font-medium">
                        {formatDate(config.startDate)}
                      </TableCell>
                      <TableCell>
                        {config.endDate ? (
                          formatDate(config.endDate)
                        ) : (
                          <span className="text-green-600 font-medium">Current</span>
                        )}
                      </TableCell>
                      <TableCell>{formatCurrency(monthlyRate)}/mo</TableCell>
                      <TableCell>{formatCurrency(config.businessAccountFee)}/mo</TableCell>
                      <TableCell>{formatCurrency(config.rate4thAdult)}/mo</TableCell>
                      <TableCell>{formatCurrency(config.minorRecipientFee)}/mo</TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">
                        {config.notes ?? '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t mt-4">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
