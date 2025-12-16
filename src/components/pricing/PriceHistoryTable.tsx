'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

function isStartDateInFuture(startDateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(startDateStr);
  startDate.setHours(0, 0, 0, 0);
  return startDate > today;
}

interface EditFormData {
  startDate: string;
  baseMonthlyRate: string;
  rate4thAdult: string;
  rate5thAdult: string;
  rate6thAdult: string;
  rate7thAdult: string;
  businessAccountFee: string;
  minorRecipientFee: string;
  keyDeposit: string;
  notes: string;
}

export function PriceHistoryTable(): React.ReactElement {
  const { data: session } = useSession();
  const isManager = session?.user?.role === 'MANAGER';

  const [history, setHistory] = useState<SerializedPriceConfig[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Edit dialog state
  const [editingConfig, setEditingConfig] = useState<SerializedPriceConfig | null>(null);
  const [editFormData, setEditFormData] = useState<EditFormData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

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

  const handleDelete = async (id: string): Promise<void> => {
    if (!confirm('Are you sure you want to delete this pricing configuration?')) {
      return;
    }

    setDeletingId(id);
    try {
      const response = await fetch(`/api/pricing/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message ?? 'Failed to delete');
      }

      // Refresh the list
      await fetchHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete pricing configuration');
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (config: SerializedPriceConfig): void => {
    const monthlyRate = config.baseRate3mo / PRICING.PERIOD_MONTHS.THREE_MONTH;
    setEditingConfig(config);
    setEditFormData({
      startDate: config.startDate,
      baseMonthlyRate: monthlyRate.toFixed(2),
      rate4thAdult: config.rate4thAdult.toFixed(2),
      rate5thAdult: config.rate5thAdult.toFixed(2),
      rate6thAdult: config.rate6thAdult.toFixed(2),
      rate7thAdult: config.rate7thAdult.toFixed(2),
      businessAccountFee: config.businessAccountFee.toFixed(2),
      minorRecipientFee: config.minorRecipientFee.toFixed(2),
      keyDeposit: config.keyDeposit.toFixed(2),
      notes: config.notes ?? '',
    });
    setEditError(null);
  };

  const handleEditChange = (field: keyof EditFormData, value: string): void => {
    if (!editFormData) return;
    setEditFormData({ ...editFormData, [field]: value });
    setEditError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!editingConfig || !editFormData) return;

    setIsSubmitting(true);
    setEditError(null);

    try {
      const response = await fetch(`/api/pricing/${editingConfig.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: editFormData.startDate,
          baseMonthlyRate: parseFloat(editFormData.baseMonthlyRate),
          rate4thAdult: parseFloat(editFormData.rate4thAdult),
          rate5thAdult: parseFloat(editFormData.rate5thAdult),
          rate6thAdult: parseFloat(editFormData.rate6thAdult),
          rate7thAdult: parseFloat(editFormData.rate7thAdult),
          businessAccountFee: parseFloat(editFormData.businessAccountFee),
          minorRecipientFee: parseFloat(editFormData.minorRecipientFee),
          keyDeposit: parseFloat(editFormData.keyDeposit),
          notes: editFormData.notes || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json() as { error?: { message?: string; details?: Array<{ field: string; message: string }> } };
        if (data.error?.details) {
          const messages = data.error.details.map((d) => `${d.field}: ${d.message}`).join(', ');
          throw new Error(messages);
        }
        throw new Error(data.error?.message ?? 'Failed to update pricing');
      }

      // Close dialog and refresh the list
      setEditingConfig(null);
      setEditFormData(null);
      await fetchHistory();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditCancel = (): void => {
    setEditingConfig(null);
    setEditFormData(null);
    setEditError(null);
  };

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
                const canDelete = isManager && isStartDateInFuture(config.startDate);
                return (
                  <div key={config.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-sm font-medium">{formatDate(config.startDate)}</span>
                        {isStartDateInFuture(config.startDate) && (
                          <span className="ml-2 text-xs text-blue-600">(Scheduled)</span>
                        )}
                      </div>
                      {config.endDate ? (
                        <span className="text-sm text-muted-foreground">→ {formatDate(config.endDate)}</span>
                      ) : isStartDateInFuture(config.startDate) ? (
                        <span className="text-sm text-muted-foreground">-</span>
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
                    {canDelete && (
                      <div className="pt-2 border-t flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(config)}
                          disabled={deletingId === config.id}
                          className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => void handleDelete(config.id)}
                          disabled={deletingId === config.id}
                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
                  {isManager && <TableHead className="w-20"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((config) => {
                  const monthlyRate = config.baseRate3mo / PRICING.PERIOD_MONTHS.THREE_MONTH;
                  const canDelete = isManager && isStartDateInFuture(config.startDate);
                  return (
                    <TableRow key={config.id}>
                      <TableCell className="font-medium">
                        {formatDate(config.startDate)}
                        {isStartDateInFuture(config.startDate) && (
                          <span className="ml-2 text-xs text-blue-600">(Scheduled)</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {config.endDate ? (
                          formatDate(config.endDate)
                        ) : isStartDateInFuture(config.startDate) ? (
                          <span className="text-muted-foreground">-</span>
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
                      {isManager && (
                        <TableCell>
                          {canDelete && (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(config)}
                                disabled={deletingId === config.id}
                                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => void handleDelete(config.id)}
                                disabled={deletingId === config.id}
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      )}
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

      {/* Edit Dialog */}
      <Dialog open={editingConfig !== null} onOpenChange={(open) => !open && handleEditCancel()}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Pricing Configuration</DialogTitle>
            <DialogDescription>
              Update the scheduled pricing configuration.
            </DialogDescription>
          </DialogHeader>
          {editFormData && (
            <form onSubmit={(e) => void handleEditSubmit(e)} className="space-y-4">
              {/* Start Date */}
              <div className="space-y-2">
                <Label htmlFor="edit-startDate">Start Date</Label>
                <Input
                  id="edit-startDate"
                  type="date"
                  value={editFormData.startDate}
                  onChange={(e) => handleEditChange('startDate', e.target.value)}
                  required
                />
              </div>

              {/* Base Monthly Rate */}
              <div className="space-y-2">
                <Label htmlFor="edit-baseMonthlyRate">Base Monthly Rate ($)</Label>
                <Input
                  id="edit-baseMonthlyRate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editFormData.baseMonthlyRate}
                  onChange={(e) => handleEditChange('baseMonthlyRate', e.target.value)}
                  required
                />
              </div>

              {/* Additional Recipient Fees */}
              <div className="space-y-2">
                <Label>Additional Recipient Fees ($/month)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="edit-rate4thAdult" className="text-xs text-muted-foreground">
                      4th Adult
                    </Label>
                    <Input
                      id="edit-rate4thAdult"
                      type="number"
                      step="0.01"
                      min="0"
                      value={editFormData.rate4thAdult}
                      onChange={(e) => handleEditChange('rate4thAdult', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-rate5thAdult" className="text-xs text-muted-foreground">
                      5th Adult
                    </Label>
                    <Input
                      id="edit-rate5thAdult"
                      type="number"
                      step="0.01"
                      min="0"
                      value={editFormData.rate5thAdult}
                      onChange={(e) => handleEditChange('rate5thAdult', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-rate6thAdult" className="text-xs text-muted-foreground">
                      6th Adult
                    </Label>
                    <Input
                      id="edit-rate6thAdult"
                      type="number"
                      step="0.01"
                      min="0"
                      value={editFormData.rate6thAdult}
                      onChange={(e) => handleEditChange('rate6thAdult', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-rate7thAdult" className="text-xs text-muted-foreground">
                      7th Adult
                    </Label>
                    <Input
                      id="edit-rate7thAdult"
                      type="number"
                      step="0.01"
                      min="0"
                      value={editFormData.rate7thAdult}
                      onChange={(e) => handleEditChange('rate7thAdult', e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Business Account Fee */}
              <div className="space-y-2">
                <Label htmlFor="edit-businessAccountFee">Business Account Fee ($/month)</Label>
                <Input
                  id="edit-businessAccountFee"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editFormData.businessAccountFee}
                  onChange={(e) => handleEditChange('businessAccountFee', e.target.value)}
                  required
                />
              </div>

              {/* Minor Recipient Fee */}
              <div className="space-y-2">
                <Label htmlFor="edit-minorRecipientFee">Minor Recipient Fee ($/month)</Label>
                <Input
                  id="edit-minorRecipientFee"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editFormData.minorRecipientFee}
                  onChange={(e) => handleEditChange('minorRecipientFee', e.target.value)}
                  required
                />
              </div>

              {/* Key Deposit */}
              <div className="space-y-2">
                <Label htmlFor="edit-keyDeposit">Key Deposit ($)</Label>
                <Input
                  id="edit-keyDeposit"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editFormData.keyDeposit}
                  onChange={(e) => handleEditChange('keyDeposit', e.target.value)}
                  required
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="edit-notes">Notes (optional)</Label>
                <Input
                  id="edit-notes"
                  type="text"
                  value={editFormData.notes}
                  onChange={(e) => handleEditChange('notes', e.target.value)}
                  placeholder="Reason for pricing change..."
                  maxLength={500}
                />
              </div>

              {/* Error */}
              {editError && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                  {editError}
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleEditCancel} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
