'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PAYMENT_METHOD_LABELS } from '@/constants/status';
import type { PaymentWithDetails } from '@/types/payment';

interface PaymentHistoryTableProps {
  payments: PaymentWithDetails[];
  showAccount?: boolean;
  loading?: boolean;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function PaymentMethodBadge({ method }: { method: string }): React.ReactElement {
  const colors: Record<string, string> = {
    CASH: 'bg-green-100 text-green-800',
    CARD: 'bg-blue-100 text-blue-800',
    CHECK: 'bg-amber-100 text-amber-800',
  };
  return (
    <Badge className={colors[method] ?? 'bg-gray-100 text-gray-800'}>
      {PAYMENT_METHOD_LABELS[method as keyof typeof PAYMENT_METHOD_LABELS] ?? method}
    </Badge>
  );
}

export function PaymentHistoryTable({
  payments,
  showAccount = false,
  loading = false,
}: PaymentHistoryTableProps): React.ReactElement {
  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-10 bg-gray-200 rounded"></div>
        <div className="h-10 bg-gray-200 rounded"></div>
        <div className="h-10 bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No payments found
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          {showAccount && <TableHead>Mailbox</TableHead>}
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Method</TableHead>
          <TableHead>Period</TableHead>
          <TableHead>Recorded By</TableHead>
          <TableHead>Notes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map((payment) => (
          <TableRow key={payment.id}>
            <TableCell>{formatDate(payment.paymentDate)}</TableCell>
            {showAccount && (
              <TableCell className="font-mono">
                {payment.account?.mailbox.number ?? '-'}
              </TableCell>
            )}
            <TableCell className="text-right font-mono">
              {formatCurrency(payment.amount)}
            </TableCell>
            <TableCell>
              <PaymentMethodBadge method={payment.paymentMethod} />
            </TableCell>
            <TableCell className="text-sm text-gray-600">
              {formatDate(payment.periodStart)} - {formatDate(payment.periodEnd)}
            </TableCell>
            <TableCell className="text-sm">
              {payment.recordedByUser.firstName ?? payment.recordedByUser.username}
            </TableCell>
            <TableCell className="text-sm text-gray-500 max-w-[200px] truncate">
              {payment.notes ?? '-'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
