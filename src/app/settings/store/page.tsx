'use client';

import { useEffect, useState, useCallback } from 'react';
import { AppLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SerializedStoreSettings } from '@/types/store-settings';

export default function StoreSettingsPage(): React.ReactElement {
  const [settings, setSettings] = useState<SerializedStoreSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isManager, setIsManager] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    street1: '',
    street2: '',
    city: '',
    zip: '',
    phone: '',
    email: '',
    hours: '',
  });

  const fetchSettings = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/settings/store');
      if (!response.ok) {
        throw new Error('Failed to fetch store settings');
      }
      const data = await response.json();
      setSettings(data.data);
      setFormData({
        name: data.data.name,
        street1: data.data.street1,
        street2: data.data.street2 ?? '',
        city: data.data.city,
        zip: data.data.zip,
        phone: data.data.phone,
        email: data.data.email,
        hours: data.data.hours,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const checkManagerRole = useCallback(async (): Promise<void> => {
    try {
      // Try to access a manager-only endpoint to check role
      const response = await fetch('/api/users');
      setIsManager(response.ok);
    } catch {
      setIsManager(false);
    }
  }, []);

  useEffect(() => {
    void fetchSettings();
    void checkManagerRole();
  }, [fetchSettings, checkManagerRole]);

  const handleSave = async (): Promise<void> => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/settings/store', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message ?? 'Failed to update settings');
      }

      const data = await response.json();
      setSettings(data.data);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = (): void => {
    if (settings) {
      setFormData({
        name: settings.name,
        street1: settings.street1,
        street2: settings.street2 ?? '',
        city: settings.city,
        zip: settings.zip,
        phone: settings.phone,
        email: settings.email,
        hours: settings.hours,
      });
    }
    setIsEditing(false);
    setError(null);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-postnet-charcoal">Store Settings</h1>
            <p className="text-muted-foreground">
              Manage store information displayed on notices
            </p>
          </div>
          <div className="bg-white rounded-lg border p-6">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 bg-gray-200 rounded" />
              ))}
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-postnet-charcoal">Store Settings</h1>
            <p className="text-muted-foreground">
              Manage store information displayed on notices
            </p>
          </div>
          {isManager && !isEditing && (
            <Button onClick={() => setIsEditing(true)}>Edit Settings</Button>
          )}
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-4 rounded-md">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg border p-6">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Store Name</Label>
              {isEditing ? (
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="PostNet"
                />
              ) : (
                <p className="text-sm text-postnet-charcoal py-2">{settings?.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="street1">Street Address</Label>
              {isEditing ? (
                <Input
                  id="street1"
                  value={formData.street1}
                  onChange={(e) => setFormData({ ...formData, street1: e.target.value })}
                  placeholder="1270 N Marine Corps Dr"
                />
              ) : (
                <p className="text-sm text-postnet-charcoal py-2">{settings?.street1}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="street2">Street Address Line 2</Label>
              {isEditing ? (
                <Input
                  id="street2"
                  value={formData.street2}
                  onChange={(e) => setFormData({ ...formData, street2: e.target.value })}
                  placeholder="Ste 101 (optional)"
                />
              ) : (
                <p className="text-sm text-postnet-charcoal py-2">
                  {settings?.street2 || <span className="text-gray-400">—</span>}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                {isEditing ? (
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Tamuning, Guam"
                  />
                ) : (
                  <p className="text-sm text-postnet-charcoal py-2">{settings?.city}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="zip">ZIP Code</Label>
                {isEditing ? (
                  <Input
                    id="zip"
                    value={formData.zip}
                    onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                    placeholder="96913"
                  />
                ) : (
                  <p className="text-sm text-postnet-charcoal py-2">{settings?.zip}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              {isEditing ? (
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(671) 123-4567"
                />
              ) : (
                <p className="text-sm text-postnet-charcoal py-2">{settings?.phone}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              {isEditing ? (
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="store@example.com"
                />
              ) : (
                <p className="text-sm text-postnet-charcoal py-2">{settings?.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="hours">Business Hours</Label>
              {isEditing ? (
                <Input
                  id="hours"
                  value={formData.hours}
                  onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                  placeholder="Mon-Fri 8am-6pm, Sat 9am-4pm, Sun Closed"
                />
              ) : (
                <p className="text-sm text-postnet-charcoal py-2">{settings?.hours}</p>
              )}
            </div>

            {isEditing && (
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                  Cancel
                </Button>
                <Button onClick={() => void handleSave()} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            )}

            {!isEditing && settings?.updatedBy && (
              <div className="pt-4 border-t">
                <p className="text-xs text-gray-500">
                  Last updated by {settings.updatedBy.username} on{' '}
                  {new Date(settings.updatedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
