'use client';

import { useEffect, useState, useCallback } from 'react';
import { AppLayout } from '@/components/layout';
import { PriceCard, PriceCalculator, PriceManagementForm, PriceHistoryTable } from '@/components/pricing';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { SerializedPriceConfig } from '@/types/pricing';

interface PricingResponse {
  success: boolean;
  data: SerializedPriceConfig;
}

export default function PricingSettingsPage(): React.ReactElement {
  const [pricing, setPricing] = useState<SerializedPriceConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isManager, setIsManager] = useState(false);

  const fetchPricing = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/pricing');

      if (!response.ok) {
        if (response.status === 404) {
          setPricing(null);
          return;
        }
        throw new Error('Failed to fetch pricing');
      }

      const data = await response.json() as PricingResponse;
      setPricing(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const checkManagerRole = useCallback(async (): Promise<void> => {
    try {
      // Try to access history endpoint - only managers can access it
      const response = await fetch('/api/pricing/history?limit=1');
      setIsManager(response.ok);
    } catch {
      setIsManager(false);
    }
  }, []);

  useEffect(() => {
    void fetchPricing();
    void checkManagerRole();
  }, [fetchPricing, checkManagerRole]);

  const handlePricingSaved = (): void => {
    void fetchPricing();
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-postnet-charcoal">Pricing Settings</h1>
          <p className="text-muted-foreground">
            View and manage pricing configuration for mailbox rentals
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-4 rounded-md">
            {error}
          </div>
        )}

        {/* Content */}
        {isManager ? (
          <Tabs defaultValue="current" className="space-y-6">
            <TabsList>
              <TabsTrigger value="current">Current Pricing</TabsTrigger>
              <TabsTrigger value="calculator">Calculator</TabsTrigger>
              <TabsTrigger value="update">Update Pricing</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="current">
              <PriceCard pricing={pricing} isLoading={isLoading} />
            </TabsContent>

            <TabsContent value="calculator">
              <PriceCalculator />
            </TabsContent>

            <TabsContent value="update">
              <PriceManagementForm
                currentPricing={pricing}
                onSave={handlePricingSaved}
              />
            </TabsContent>

            <TabsContent value="history">
              <PriceHistoryTable />
            </TabsContent>
          </Tabs>
        ) : (
          /* Staff view - only current pricing and calculator */
          <div className="grid gap-6 lg:grid-cols-2">
            <PriceCard pricing={pricing} isLoading={isLoading} />
            <PriceCalculator />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
