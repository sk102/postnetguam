'use client';

import { useState, useEffect } from 'react';
import { formatPhoneForInput, parsePhoneToE164 } from '@/lib/utils/phone';

interface PhoneNumber {
  id?: string;
  phone: string;
  isMobile: boolean;
  isPrimary: boolean;
  label: string;
  _delete?: boolean;
  _isNew?: boolean;
}

interface EmailAddress {
  id?: string;
  email: string;
  isPrimary: boolean;
  label: string;
  _delete?: boolean;
  _isNew?: boolean;
}

interface ContactData {
  phoneNumbers: PhoneNumber[];
  emailAddresses: EmailAddress[];
}

interface ContactEditDialogProps {
  isOpen: boolean;
  data: ContactData | null;
  onClose: () => void;
  onSave: (data: ContactData) => void;
}

export function ContactEditDialog({
  isOpen,
  data,
  onClose,
  onSave,
}: ContactEditDialogProps): React.ReactElement | null {
  const [formData, setFormData] = useState<ContactData>({
    phoneNumbers: [],
    emailAddresses: [],
  });

  useEffect(() => {
    if (data) {
      setFormData({
        phoneNumbers: data.phoneNumbers.map((p) => ({
          ...p,
          phone: formatPhoneForInput(p.phone),
        })),
        emailAddresses: [...data.emailAddresses],
      });
    }
  }, [data]);

  if (!isOpen || !data) return null;

  const handlePhoneBlur = (index: number, value: string): void => {
    const formatted = formatPhoneForInput(value);
    if (formatted !== value) {
      const updated = [...formData.phoneNumbers];
      const current = updated[index];
      if (current) {
        updated[index] = { ...current, phone: formatted };
        setFormData({ ...formData, phoneNumbers: updated });
      }
    }
  };

  const addPhone = (): void => {
    setFormData({
      ...formData,
      phoneNumbers: [
        ...formData.phoneNumbers,
        { phone: '', isMobile: true, isPrimary: false, label: '', _isNew: true },
      ],
    });
  };

  const removePhone = (index: number): void => {
    const phone = formData.phoneNumbers[index];
    if (!phone) return;
    if (phone.id) {
      const updated = [...formData.phoneNumbers];
      updated[index] = { ...phone, _delete: true };
      setFormData({ ...formData, phoneNumbers: updated });
    } else {
      setFormData({
        ...formData,
        phoneNumbers: formData.phoneNumbers.filter((_, i) => i !== index),
      });
    }
  };

  const updatePhone = (index: number, updates: Partial<PhoneNumber>): void => {
    const updated = [...formData.phoneNumbers];
    const current = updated[index];
    if (current) {
      updated[index] = { ...current, ...updates };
      setFormData({ ...formData, phoneNumbers: updated });
    }
  };

  const addEmail = (): void => {
    setFormData({
      ...formData,
      emailAddresses: [
        ...formData.emailAddresses,
        { email: '', isPrimary: false, label: '', _isNew: true },
      ],
    });
  };

  const removeEmail = (index: number): void => {
    const email = formData.emailAddresses[index];
    if (!email) return;
    if (email.id) {
      const updated = [...formData.emailAddresses];
      updated[index] = { ...email, _delete: true };
      setFormData({ ...formData, emailAddresses: updated });
    } else {
      setFormData({
        ...formData,
        emailAddresses: formData.emailAddresses.filter((_, i) => i !== index),
      });
    }
  };

  const updateEmail = (index: number, updates: Partial<EmailAddress>): void => {
    const updated = [...formData.emailAddresses];
    const current = updated[index];
    if (current) {
      updated[index] = { ...current, ...updates };
      setFormData({ ...formData, emailAddresses: updated });
    }
  };

  const handleSave = (): void => {
    // Convert phone numbers to E.164 format
    const savedData: ContactData = {
      phoneNumbers: formData.phoneNumbers.map((p) => ({
        ...p,
        phone: parsePhoneToE164(p.phone),
      })),
      emailAddresses: formData.emailAddresses,
    };
    onSave(savedData);
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
        <div className="relative w-full max-w-lg rounded-lg bg-white shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Edit Contact Information
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
          <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
            {/* Phone Numbers Section */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-700">Phone Numbers</h4>
                <button
                  type="button"
                  onClick={addPhone}
                  className="text-xs text-postnet-red hover:underline"
                >
                  + Add Phone
                </button>
              </div>
              <div className="space-y-2">
                {formData.phoneNumbers.map((phone, index) => {
                  if (phone._delete) return null;
                  return (
                    <div key={phone.id ?? `new-phone-${index}`} className="flex items-center gap-2 bg-gray-50 p-2 rounded">
                      <input
                        type="tel"
                        value={phone.phone}
                        onChange={(e) => updatePhone(index, { phone: e.target.value })}
                        onBlur={(e) => handlePhoneBlur(index, e.target.value)}
                        placeholder="+1 ___ ___ ____"
                        className="w-36 rounded-md border px-2 py-1 text-sm font-mono"
                      />
                      <input
                        type="text"
                        value={phone.label}
                        onChange={(e) => updatePhone(index, { label: e.target.value })}
                        placeholder="Label"
                        className="w-20 rounded-md border px-2 py-1 text-sm"
                      />
                      <label className="flex items-center gap-1 text-xs text-gray-600">
                        <input
                          type="checkbox"
                          checked={phone.isMobile}
                          onChange={(e) => updatePhone(index, { isMobile: e.target.checked })}
                          className="rounded border-gray-300"
                        />
                        Mobile
                      </label>
                      <button
                        type="button"
                        onClick={() => removePhone(index)}
                        className="text-red-500 hover:text-red-700 text-sm ml-auto"
                        aria-label="Remove phone"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
                {formData.phoneNumbers.filter((p) => !p._delete).length === 0 && (
                  <p className="text-sm text-gray-400 italic">No phone numbers</p>
                )}
              </div>
            </div>

            {/* Email Addresses Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-700">Email Addresses</h4>
                <button
                  type="button"
                  onClick={addEmail}
                  className="text-xs text-postnet-red hover:underline"
                >
                  + Add Email
                </button>
              </div>
              <div className="space-y-2">
                {formData.emailAddresses.map((email, index) => {
                  if (email._delete) return null;
                  return (
                    <div key={email.id ?? `new-email-${index}`} className="flex items-center gap-2 bg-gray-50 p-2 rounded">
                      <input
                        type="email"
                        value={email.email}
                        onChange={(e) => updateEmail(index, { email: e.target.value })}
                        placeholder="email@example.com"
                        className="flex-1 rounded-md border px-2 py-1 text-sm"
                      />
                      <input
                        type="text"
                        value={email.label}
                        onChange={(e) => updateEmail(index, { label: e.target.value })}
                        placeholder="Label"
                        className="w-20 rounded-md border px-2 py-1 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeEmail(index)}
                        className="text-red-500 hover:text-red-700 text-sm"
                        aria-label="Remove email"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
                {formData.emailAddresses.filter((e) => !e._delete).length === 0 && (
                  <p className="text-sm text-gray-400 italic">No email addresses</p>
                )}
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
