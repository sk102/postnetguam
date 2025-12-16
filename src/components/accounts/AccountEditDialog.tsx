'use client';

import { useState, useEffect } from 'react';

interface AccountEditData {
  status: string;
  renewalPeriod: string;
  currentRate: string;
  nextRenewalDate: string;
  smsEnabled: boolean;
  emailEnabled: boolean;
}

interface AccountEditDialogProps {
  isOpen: boolean;
  data: AccountEditData | null;
  onClose: () => void;
  onSave: (data: AccountEditData) => void;
}

export function AccountEditDialog({
  isOpen,
  data,
  onClose,
  onSave,
}: AccountEditDialogProps): React.ReactElement | null {
  const [formData, setFormData] = useState<AccountEditData>({
    status: 'ACTIVE',
    renewalPeriod: 'THREE_MONTH',
    currentRate: '0',
    nextRenewalDate: '',
    smsEnabled: false,
    emailEnabled: false,
  });

  useEffect(() => {
    if (data) {
      setFormData({
        ...data,
        nextRenewalDate: data.nextRenewalDate.split('T')[0] ?? '',
      });
    }
  }, [data]);

  if (!isOpen || !data) return null;

  const handleSave = (): void => {
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Dialog */}
        <div className="relative w-full max-w-md rounded-lg bg-white shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Edit Account Information
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-4 space-y-4">
            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="ACTIVE">Active</option>
                <option value="HOLD">Hold</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>

            {/* Renewal Period */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Renewal Period</label>
              <select
                value={formData.renewalPeriod}
                onChange={(e) => setFormData({ ...formData, renewalPeriod: e.target.value })}
                className="w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="THREE_MONTH">3 Months</option>
                <option value="SIX_MONTH">6 Months</option>
                <option value="TWELVE_MONTH">12 Months</option>
              </select>
            </div>

            {/* Current Rate */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Rate ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.currentRate}
                onChange={(e) => setFormData({ ...formData, currentRate: e.target.value })}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>

            {/* Next Renewal Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Next Renewal Date</label>
              <input
                type="date"
                value={formData.nextRenewalDate}
                onChange={(e) => setFormData({ ...formData, nextRenewalDate: e.target.value })}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>

            {/* Notification Preferences */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notifications</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={formData.smsEnabled}
                    onChange={(e) => setFormData({ ...formData, smsEnabled: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  SMS
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={formData.emailEnabled}
                    onChange={(e) => setFormData({ ...formData, emailEnabled: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  Email
                </label>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t px-6 py-4">
            <button
              onClick={onClose}
              className="rounded-md border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="rounded-md bg-postnet-red px-4 py-2 text-sm text-white hover:bg-postnet-red-dark"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
