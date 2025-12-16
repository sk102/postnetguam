'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { PAYMENT_METHOD_LABELS } from '@/constants/status';

interface PaymentFiltersProps {
  startDate: string;
  endDate: string;
  paymentMethod: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onPaymentMethodChange: (value: string) => void;
  onClear: () => void;
}

export function PaymentFilters({
  startDate,
  endDate,
  paymentMethod,
  onStartDateChange,
  onEndDateChange,
  onPaymentMethodChange,
  onClear,
}: PaymentFiltersProps): React.ReactElement {
  const hasFilters = startDate || endDate || paymentMethod;

  return (
    <div className="flex flex-wrap gap-4 items-end">
      <div className="space-y-1">
        <Label htmlFor="startDate" className="text-xs">From</Label>
        <Input
          id="startDate"
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="w-40"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="endDate" className="text-xs">To</Label>
        <Input
          id="endDate"
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="w-40"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="paymentMethod" className="text-xs">Method</Label>
        <Select value={paymentMethod} onValueChange={onPaymentMethodChange}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All</SelectItem>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
