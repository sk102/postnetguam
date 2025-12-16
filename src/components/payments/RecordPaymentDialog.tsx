'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PAYMENT_METHOD_LABELS } from '@/constants/status';

interface InvoiceLineItem {
  description: string;
  unitPrice: number;
  months: number;
  total: number;
}

interface AccountInvoiceInfo {
  mailboxNumber: number;
  recipientName: string;
  renewalPeriod: string;
  currentRate: number;
  startDate: string;
  nextRenewalDate: string;
  totalPayments: number;
  isRenewal?: boolean;
  lineItems?: InvoiceLineItem[];
  invoiceId?: string;
}

interface RecordPaymentDialogProps {
  isOpen: boolean;
  accountId: string;
  isRenewal?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function formatRenewalPeriod(period: string): { label: string; months: number } {
  switch (period) {
    case 'THREE_MONTH':
      return { label: '3 Months', months: 3 };
    case 'SIX_MONTH':
      return { label: '6 Months', months: 6 };
    case 'TWELVE_MONTH':
      return { label: '12 Months', months: 12 };
    default:
      return { label: '3 Months', months: 3 };
  }
}

function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'N/A';
  }
}

function formatCurrency(amount: number): string {
  if (isNaN(amount)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function formatMonths(months: number): string {
  // Show 2 decimal places only if not a whole number
  if (Number.isInteger(months)) {
    return months.toString();
  }
  return months.toFixed(2);
}

export function RecordPaymentDialog({
  isOpen,
  accountId,
  isRenewal = false,
  onClose,
  onSuccess,
}: RecordPaymentDialogProps): React.ReactElement {
  const today = new Date().toISOString().split('T')[0] ?? '';

  const [loading, setLoading] = useState(false);
  const [invoiceInfo, setInvoiceInfo] = useState<AccountInvoiceInfo | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(today);
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedPeriod(null);
      setInvoiceInfo(null);
      setIsInitialLoad(true);
    }
  }, [isOpen]);

  // Fetch account and payment info when dialog opens, period changes, or payment date changes
  useEffect(() => {
    if (isOpen && accountId) {
      setLoading(true);
      setError(null);

      let url: string;
      if (isRenewal) {
        url = `/api/accounts/${accountId}/invoice?renewal=true`;
        if (selectedPeriod) {
          url += `&period=${selectedPeriod}`;
        }
        // Include payment date for rate lookup in renewal mode
        if (paymentDate) {
          url += `&paymentDate=${paymentDate}`;
        }
      } else {
        url = `/api/accounts/${accountId}/invoice`;
      }

      fetch(url)
        .then(async (res) => {
          if (!res.ok) {
            throw new Error('Failed to load account information');
          }
          const json = await res.json() as { data?: AccountInvoiceInfo } | AccountInvoiceInfo;
          // Handle both wrapped and unwrapped responses
          const data = 'data' in json && json.data ? json.data : json as AccountInvoiceInfo;
          return data;
        })
        .then((data) => {
          setInvoiceInfo(data);

          // Initialize selectedPeriod from response if not already set (first load)
          if (isRenewal && !selectedPeriod) {
            setSelectedPeriod(data.renewalPeriod);
          }

          // Calculate balance due and pre-fill amount
          const { months } = formatRenewalPeriod(data.renewalPeriod);
          const rate = data.currentRate || 0;
          const totalCharge = rate * months;
          const balanceDue = Math.max(0, totalCharge - (data.totalPayments || 0));
          setAmount(balanceDue.toFixed(2));

          // Only reset other form fields on initial load
          if (isInitialLoad) {
            setPaymentMethod('CASH');
            setNotes('');
            setIsInitialLoad(false);
          }
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Failed to load account');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, accountId, isRenewal, selectedPeriod, paymentDate, isInitialLoad]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (!paymentDate) {
      setError('Please select a payment date');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Use the term dates from the invoice info
      const periodStart = invoiceInfo?.startDate?.split('T')[0] ?? today;
      const periodEnd = invoiceInfo?.nextRenewalDate?.split('T')[0] ?? today;

      // Build payment payload
      const payload: Record<string, unknown> = {
        accountId,
        amount: amountNum,
        paymentDate,
        paymentMethod,
        periodStart,
        periodEnd,
        notes: notes || undefined,
        invoiceId: invoiceInfo?.invoiceId,
      };

      // Add renewal data if this is a renewal payment
      const isRenewalPayment = invoiceInfo?.isRenewal ?? isRenewal;
      if (isRenewalPayment && invoiceInfo) {
        payload.isRenewal = true;
        payload.renewalPeriod = invoiceInfo.renewalPeriod;
        payload.newRate = invoiceInfo.currentRate;
      }

      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json() as { error?: { message?: string } };
        throw new Error(data.error?.message ?? 'Failed to record payment');
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  // Calculate invoice totals
  const periodInfo = invoiceInfo ? formatRenewalPeriod(invoiceInfo.renewalPeriod) : null;
  const rate = invoiceInfo?.currentRate || 0;
  const totalCharge = periodInfo ? rate * periodInfo.months : 0;
  const totalPayments = invoiceInfo?.totalPayments || 0;
  const balanceDue = Math.max(0, totalCharge - totalPayments);

  // Determine if this is a renewal based on response or prop
  const isRenewalMode = invoiceInfo?.isRenewal ?? isRenewal;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isRenewalMode ? 'Renew Account' : 'Record Payment'}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-gray-500">
            Loading account information...
          </div>
        ) : error && !invoiceInfo ? (
          <div className="py-8 text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        ) : invoiceInfo ? (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            {/* Invoice Summary */}
            <div className="rounded-lg border bg-gray-50 p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    Mailbox {invoiceInfo.mailboxNumber}
                  </h3>
                  <p className="text-sm text-gray-600">{invoiceInfo.recipientName}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {isRenewalMode && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                      Renewal
                    </span>
                  )}
                  {isRenewalMode ? (
                    <Select value={selectedPeriod ?? invoiceInfo.renewalPeriod} onValueChange={setSelectedPeriod}>
                      <SelectTrigger className="h-7 w-[110px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="THREE_MONTH">3 Months</SelectItem>
                        <SelectItem value="SIX_MONTH">6 Months</SelectItem>
                        <SelectItem value="TWELVE_MONTH">12 Months</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                      {periodInfo?.label}
                    </span>
                  )}
                </div>
              </div>

              <div className="text-xs text-gray-500 mb-3">
                {isRenewalMode ? 'New Term' : 'Term'}: {formatDate(invoiceInfo.startDate)} - {formatDate(invoiceInfo.nextRenewalDate)}
              </div>

              <div className="border-t pt-3 space-y-2">
                {/* Itemized line items */}
                {invoiceInfo.lineItems && invoiceInfo.lineItems.length > 0 ? (
                  <>
                    {invoiceInfo.lineItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-gray-600">{item.description}</span>
                        <span className="font-mono">
                          {formatCurrency(item.unitPrice)} × {formatMonths(item.months)} = {formatCurrency(item.total)}
                        </span>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      Monthly Rate × {periodInfo?.months} months
                    </span>
                    <span className="font-mono">
                      {formatCurrency(rate)} × {periodInfo?.months}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-medium border-t pt-2 mt-2">
                  <span>Total Charge</span>
                  <span className="font-mono">{formatCurrency(totalCharge)}</span>
                </div>
                {totalPayments > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Payments Made</span>
                    <span className="font-mono">-{formatCurrency(totalPayments)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold border-t pt-2">
                  <span>Balance Due</span>
                  <span className={`font-mono ${balanceDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(balanceDue)}
                  </span>
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Payment Amount *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-7 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Method *</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentDate">Payment Date *</Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Paid with credit card ending 1234"
                maxLength={500}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Recording...' : 'Record Payment'}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
