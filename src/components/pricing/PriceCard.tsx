'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { SerializedPriceConfig } from '@/types/pricing';
import { PRICING } from '@/constants/app';

interface PriceCardProps {
  pricing: SerializedPriceConfig | null;
  isLoading?: boolean;
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
    month: 'long',
    day: 'numeric',
  });
}

export function PriceCard({ pricing, isLoading }: PriceCardProps): React.ReactElement {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Current Pricing</CardTitle>
          <CardDescription>Loading pricing information...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!pricing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Current Pricing</CardTitle>
          <CardDescription>No pricing configuration found</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Please configure pricing to enable account creation.
          </p>
        </CardContent>
      </Card>
    );
  }

  const monthlyRate = pricing.baseRate3mo / PRICING.PERIOD_MONTHS.THREE_MONTH;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Current Pricing</CardTitle>
        <CardDescription>
          Effective since {formatDate(pricing.startDate)}
          {pricing.endDate ? ` (ended ${formatDate(pricing.endDate)})` : ' (current)'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Base Rates */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-2">Base Monthly Rate</h4>
          <p className="text-2xl font-bold text-primary">{formatCurrency(monthlyRate)}/month</p>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-2 border-t">
          <div>
            <p className="text-xs text-muted-foreground">3-Month</p>
            <p className="text-sm font-medium">{formatCurrency(pricing.baseRate3mo)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">6-Month</p>
            <p className="text-sm font-medium">{formatCurrency(pricing.baseRate6mo)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">12-Month</p>
            <p className="text-sm font-medium">{formatCurrency(pricing.baseRate12mo)}</p>
          </div>
        </div>

        {/* Additional Fees */}
        <div className="pt-2 border-t">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Additional Fees (Monthly)</h4>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Business Account</span>
              <span className="font-medium">{formatCurrency(pricing.businessAccountFee)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Minor Recipient</span>
              <span className="font-medium">{formatCurrency(pricing.minorRecipientFee)}</span>
            </div>
          </div>
        </div>

        {/* Additional Recipients */}
        <div className="pt-2 border-t">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Additional Recipients (Monthly)</h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">4th Adult</span>
              <span className="font-medium">{formatCurrency(pricing.rate4thAdult)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">5th Adult</span>
              <span className="font-medium">{formatCurrency(pricing.rate5thAdult)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">6th Adult</span>
              <span className="font-medium">{formatCurrency(pricing.rate6thAdult)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">7th Adult</span>
              <span className="font-medium">{formatCurrency(pricing.rate7thAdult)}</span>
            </div>
          </div>
        </div>

        {/* Key Deposit */}
        <div className="pt-2 border-t">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Key Deposit</span>
            <span className="font-medium">{formatCurrency(pricing.keyDeposit)}</span>
          </div>
        </div>

        {/* Notes */}
        {pricing.notes && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">{pricing.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
