'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PRICING } from '@/constants/app';
import type { SerializedPriceConfig } from '@/types/pricing';

interface PriceManagementFormProps {
  currentPricing: SerializedPriceConfig | null;
  onSave: () => void;
}

interface FormData {
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

export function PriceManagementForm({
  currentPricing,
  onSave,
}: PriceManagementFormProps): React.ReactElement {
  const today = new Date().toISOString().split('T')[0] ?? '';

  const [formData, setFormData] = useState<FormData>(() => {
    if (currentPricing) {
      const monthlyRate = currentPricing.baseRate3mo / PRICING.PERIOD_MONTHS.THREE_MONTH;
      return {
        startDate: today,
        baseMonthlyRate: monthlyRate.toFixed(2),
        rate4thAdult: currentPricing.rate4thAdult.toFixed(2),
        rate5thAdult: currentPricing.rate5thAdult.toFixed(2),
        rate6thAdult: currentPricing.rate6thAdult.toFixed(2),
        rate7thAdult: currentPricing.rate7thAdult.toFixed(2),
        businessAccountFee: currentPricing.businessAccountFee.toFixed(2),
        minorRecipientFee: currentPricing.minorRecipientFee.toFixed(2),
        keyDeposit: currentPricing.keyDeposit.toFixed(2),
        notes: '',
      };
    }
    return {
      startDate: today,
      baseMonthlyRate: PRICING.DEFAULT_BASE_MONTHLY_RATE.toFixed(2),
      rate4thAdult: PRICING.DEFAULT_ADDITIONAL_RECIPIENT_FEE.toFixed(2),
      rate5thAdult: PRICING.DEFAULT_ADDITIONAL_RECIPIENT_FEE.toFixed(2),
      rate6thAdult: PRICING.DEFAULT_ADDITIONAL_RECIPIENT_FEE.toFixed(2),
      rate7thAdult: PRICING.DEFAULT_ADDITIONAL_RECIPIENT_FEE.toFixed(2),
      businessAccountFee: PRICING.DEFAULT_BUSINESS_ACCOUNT_FEE.toFixed(2),
      minorRecipientFee: PRICING.DEFAULT_MINOR_RECIPIENT_FEE.toFixed(2),
      keyDeposit: PRICING.DEFAULT_KEY_DEPOSIT.toFixed(2),
      notes: '',
    };
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (field: keyof FormData, value: string): void => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: formData.startDate,
          baseMonthlyRate: parseFloat(formData.baseMonthlyRate),
          rate4thAdult: parseFloat(formData.rate4thAdult),
          rate5thAdult: parseFloat(formData.rate5thAdult),
          rate6thAdult: parseFloat(formData.rate6thAdult),
          rate7thAdult: parseFloat(formData.rate7thAdult),
          businessAccountFee: parseFloat(formData.businessAccountFee),
          minorRecipientFee: parseFloat(formData.minorRecipientFee),
          keyDeposit: parseFloat(formData.keyDeposit),
          notes: formData.notes || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json() as { error?: { message?: string; details?: Array<{ field: string; message: string }> } };
        if (data.error?.details) {
          const messages = data.error.details.map((d) => `${d.field}: ${d.message}`).join(', ');
          throw new Error(messages);
        }
        throw new Error(data.error?.message ?? 'Failed to save pricing');
      }

      setSuccess(true);
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Update Pricing</CardTitle>
        <CardDescription>
          Create a new pricing configuration. This will not affect existing accounts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
          {/* Start Date */}
          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="date"
              value={formData.startDate}
              onChange={(e) => handleChange('startDate', e.target.value)}
              min={today}
              required
            />
            <p className="text-xs text-muted-foreground">
              The date when this pricing will become active (previous rate will end the day before)
            </p>
          </div>

          {/* Base Monthly Rate */}
          <div className="space-y-2">
            <Label htmlFor="baseMonthlyRate">Base Monthly Rate ($)</Label>
            <Input
              id="baseMonthlyRate"
              type="number"
              step="0.01"
              min="0"
              value={formData.baseMonthlyRate}
              onChange={(e) => handleChange('baseMonthlyRate', e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Monthly rate for up to {PRICING.INCLUDED_RECIPIENTS} adult recipients
            </p>
          </div>

          {/* Additional Recipient Fees */}
          <div className="space-y-3">
            <Label>Additional Recipient Fees ($/month)</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="rate4thAdult" className="text-xs text-muted-foreground">
                  4th Adult
                </Label>
                <Input
                  id="rate4thAdult"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.rate4thAdult}
                  onChange={(e) => handleChange('rate4thAdult', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rate5thAdult" className="text-xs text-muted-foreground">
                  5th Adult
                </Label>
                <Input
                  id="rate5thAdult"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.rate5thAdult}
                  onChange={(e) => handleChange('rate5thAdult', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rate6thAdult" className="text-xs text-muted-foreground">
                  6th Adult
                </Label>
                <Input
                  id="rate6thAdult"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.rate6thAdult}
                  onChange={(e) => handleChange('rate6thAdult', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rate7thAdult" className="text-xs text-muted-foreground">
                  7th Adult
                </Label>
                <Input
                  id="rate7thAdult"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.rate7thAdult}
                  onChange={(e) => handleChange('rate7thAdult', e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Business Account Fee */}
          <div className="space-y-2">
            <Label htmlFor="businessAccountFee">Business Account Fee ($/month)</Label>
            <Input
              id="businessAccountFee"
              type="number"
              step="0.01"
              min="0"
              value={formData.businessAccountFee}
              onChange={(e) => handleChange('businessAccountFee', e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Additional monthly fee when any recipient is a business
            </p>
          </div>

          {/* Minor Recipient Fee */}
          <div className="space-y-2">
            <Label htmlFor="minorRecipientFee">Minor Recipient Fee ($/month)</Label>
            <Input
              id="minorRecipientFee"
              type="number"
              step="0.01"
              min="0"
              value={formData.minorRecipientFee}
              onChange={(e) => handleChange('minorRecipientFee', e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Fee per minor recipient (under 18)
            </p>
          </div>

          {/* Key Deposit */}
          <div className="space-y-2">
            <Label htmlFor="keyDeposit">Key Deposit ($)</Label>
            <Input
              id="keyDeposit"
              type="number"
              step="0.01"
              min="0"
              value={formData.keyDeposit}
              onChange={(e) => handleChange('keyDeposit', e.target.value)}
              required
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              type="text"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Reason for pricing change..."
              maxLength={500}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md">
              Pricing configuration saved successfully!
            </div>
          )}

          {/* Submit */}
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Saving...' : 'Save New Pricing'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
