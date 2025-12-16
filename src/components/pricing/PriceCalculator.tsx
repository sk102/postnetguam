'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { PriceBreakdown } from '@/types/pricing';
import { PRICING } from '@/constants/app';

interface PriceCalculatorProps {
  onCalculate?: (breakdown: PriceBreakdown) => void;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

type RenewalPeriod = 'THREE_MONTH' | 'SIX_MONTH' | 'TWELVE_MONTH';

export function PriceCalculator({ onCalculate }: PriceCalculatorProps): React.ReactElement {
  const [renewalPeriod, setRenewalPeriod] = useState<RenewalPeriod>('THREE_MONTH');
  const [adultCount, setAdultCount] = useState(1);
  const [minorCount, setMinorCount] = useState(0);
  const [hasBusiness, setHasBusiness] = useState(false);
  const [breakdown, setBreakdown] = useState<PriceBreakdown | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/pricing/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          renewalPeriod,
          adultRecipientCount: adultCount,
          minorRecipientCount: minorCount,
          hasBusinessRecipient: hasBusiness,
        }),
      });

      if (!response.ok) {
        const data = await response.json() as { error?: { message?: string } };
        throw new Error(data.error?.message ?? 'Failed to calculate pricing');
      }

      const data = await response.json() as { data: PriceBreakdown };
      setBreakdown(data.data);
      onCalculate?.(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [renewalPeriod, adultCount, minorCount, hasBusiness, onCalculate]);

  // Calculate on initial load and when inputs change
  useEffect(() => {
    void calculate();
  }, [calculate]);

  const periodLabel = {
    THREE_MONTH: '3 Months',
    SIX_MONTH: '6 Months',
    TWELVE_MONTH: '12 Months',
  };

  const periodDescription = {
    THREE_MONTH: '3 months of service',
    SIX_MONTH: '6 months of service',
    TWELVE_MONTH: '13 months of service (1 month bonus!)',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Price Calculator</CardTitle>
        <CardDescription>
          Calculate the total price based on account configuration
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Renewal Period */}
        <div className="space-y-2">
          <Label>Renewal Period</Label>
          <div className="flex gap-2">
            {(['THREE_MONTH', 'SIX_MONTH', 'TWELVE_MONTH'] as const).map((period) => (
              <Button
                key={period}
                type="button"
                variant={renewalPeriod === period ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRenewalPeriod(period)}
              >
                {periodLabel[period]}
              </Button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {periodDescription[renewalPeriod]}
          </p>
        </div>

        {/* Adult Recipients */}
        <div className="space-y-2">
          <Label>Adult Recipients</Label>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setAdultCount((c) => Math.max(1, c - 1))}
              disabled={adultCount <= 1}
            >
              -
            </Button>
            <span className="w-8 text-center font-medium">{adultCount}</span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setAdultCount((c) => Math.min(PRICING.MAX_RECIPIENTS - minorCount, c + 1))}
              disabled={adultCount + minorCount >= PRICING.MAX_RECIPIENTS}
            >
              +
            </Button>
            <span className="text-sm text-muted-foreground">
              (First {PRICING.INCLUDED_RECIPIENTS} included in base rate)
            </span>
          </div>
        </div>

        {/* Minor Recipients */}
        <div className="space-y-2">
          <Label>Minor Recipients</Label>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setMinorCount((c) => Math.max(0, c - 1))}
              disabled={minorCount <= 0}
            >
              -
            </Button>
            <span className="w-8 text-center font-medium">{minorCount}</span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setMinorCount((c) => Math.min(PRICING.MAX_RECIPIENTS - adultCount, c + 1))}
              disabled={adultCount + minorCount >= PRICING.MAX_RECIPIENTS}
            >
              +
            </Button>
          </div>
        </div>

        {/* Business Account */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="hasBusiness"
            checked={hasBusiness}
            onChange={(e) => setHasBusiness(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          <Label htmlFor="hasBusiness" className="cursor-pointer">
            Includes Business Recipient
          </Label>
        </div>

        {/* Total Recipients */}
        <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
          <span className="text-sm font-medium">Total Recipients</span>
          <span className={`text-sm font-medium ${adultCount + minorCount >= PRICING.MAX_RECIPIENTS ? 'text-amber-600' : ''}`}>
            {adultCount + minorCount} / {PRICING.MAX_RECIPIENTS} max
          </span>
        </div>

        {/* Error */}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
            {error}
          </div>
        )}

        {/* Price Breakdown */}
        {breakdown ? (
          <div className={`border-t pt-4 space-y-3 transition-opacity duration-200 ${isLoading ? 'opacity-60' : 'opacity-100'}`}>
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-900">Price Breakdown</h4>
              {isLoading && (
                <span className="text-xs text-muted-foreground">Updating...</span>
              )}
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base Rate ({periodLabel[renewalPeriod]})</span>
                <span>{formatCurrency(breakdown.baseRate)}</span>
              </div>

              {breakdown.businessFee > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Business Account Fee</span>
                  <span>{formatCurrency(breakdown.businessFee)}</span>
                </div>
              )}

              {breakdown.additionalRecipientFees > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Additional Recipients ({adultCount - PRICING.INCLUDED_RECIPIENTS})
                  </span>
                  <span>{formatCurrency(breakdown.additionalRecipientFees)}</span>
                </div>
              )}

              {breakdown.minorFees > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Minor Recipients ({minorCount})</span>
                  <span>{formatCurrency(breakdown.minorFees)}</span>
                </div>
              )}
            </div>

            <div className="border-t pt-3 space-y-2">
              <div className="flex justify-between font-medium">
                <span>Total for Period</span>
                <span className="text-lg text-primary">{formatCurrency(breakdown.totalForPeriod)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Monthly Rate</span>
                <span>{formatCurrency(breakdown.totalMonthly)}/month</span>
              </div>
              {renewalPeriod === 'TWELVE_MONTH' && (
                <div className="flex justify-between text-sm text-green-600 font-medium">
                  <span>Effective Rate (with bonus month)</span>
                  <span>{formatCurrency(breakdown.totalForPeriod / 13)}/month</span>
                </div>
              )}
            </div>
          </div>
        ) : isLoading ? (
          <div className="border-t pt-4">
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-6 bg-gray-200 rounded w-1/2 mt-4"></div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
