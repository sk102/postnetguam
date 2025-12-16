'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { formatPhoneForInput, parsePhoneToE164 } from '@/lib/utils/phone';
import { ID_TYPES } from '@/constants/app';

const PHONE_LABEL_OPTIONS = ['Personal', 'Work', 'Other'] as const;
const EMAIL_LABEL_OPTIONS = ['Personal', 'Work', 'Other'] as const;

// Helper to determine if a label is a predefined option or custom
function isCustomLabel(label: string): boolean {
  return label !== '' && label !== 'Personal' && label !== 'Work';
}

// Get the select value for a label (either the label itself or 'Other' for custom)
function getLabelSelectValue(label: string): string {
  if (label === '' || label === 'Personal' || label === 'Work') {
    return label;
  }
  return 'Other';
}

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

interface RecipientData {
  id?: string;
  isPrimary: boolean;
  recipientType: string;
  firstName: string;
  middleName: string;
  lastName: string;
  personAlias: string;
  birthdate: string | null;
  businessName: string;
  businessAlias: string;
  idType: string | null;
  idStateCountry: string | null;
  idExpirationDate: string | null;
  idVerifiedDate: string | null;
  idVerifiedBy: string | null;
  phoneNumbers: PhoneNumber[];
  emailAddresses: EmailAddress[];
}

interface RecipientEditDialogProps {
  isOpen: boolean;
  recipient: RecipientData | null;
  onClose: () => void;
  onSave: (data: RecipientData) => void;
}

export function RecipientEditDialog({
  isOpen,
  recipient,
  onClose,
  onSave,
}: RecipientEditDialogProps): React.ReactElement | null {
  const { data: session } = useSession();
  const [formData, setFormData] = useState<RecipientData>({
    isPrimary: false,
    recipientType: 'PERSON',
    firstName: '',
    middleName: '',
    lastName: '',
    personAlias: '',
    birthdate: null,
    businessName: '',
    businessAlias: '',
    idType: null,
    idStateCountry: null,
    idExpirationDate: null,
    idVerifiedDate: null,
    idVerifiedBy: null,
    phoneNumbers: [],
    emailAddresses: [],
  });

  useEffect(() => {
    if (recipient) {
      setFormData({
        ...recipient,
        phoneNumbers: recipient.phoneNumbers.map((p) => ({
          ...p,
          phone: formatPhoneForInput(p.phone),
        })),
      });
    }
  }, [recipient]);

  if (!isOpen || !recipient) return null;

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

  // Helper to format person name for display/conversion
  const getPersonDisplayName = (): string => {
    return [
      formData.firstName,
      formData.middleName,
      formData.personAlias ? `"${formData.personAlias}"` : '',
      formData.lastName,
    ].filter(Boolean).join(' ');
  };

  // Handle type change with auto-population
  const handleTypeChange = (newType: 'PERSON' | 'BUSINESS'): void => {
    if (newType === 'BUSINESS' && formData.recipientType === 'PERSON') {
      // Converting Person to Business: use person display name as business name
      const personName = getPersonDisplayName();
      setFormData({
        ...formData,
        recipientType: 'BUSINESS',
        businessName: personName || formData.businessName,
      });
    } else if (newType === 'PERSON' && formData.recipientType === 'BUSINESS') {
      // Converting Business to Person: keep as is (user will fill in person fields)
      setFormData({
        ...formData,
        recipientType: 'PERSON',
      });
    } else {
      setFormData({ ...formData, recipientType: newType });
    }
  };

  const handleSave = (): void => {
    // Convert phone numbers back to E.164 format and clear irrelevant fields
    let savedData: RecipientData = {
      ...formData,
      phoneNumbers: formData.phoneNumbers.map((p) => ({
        ...p,
        phone: parsePhoneToE164(p.phone),
      })),
    };

    // Clear irrelevant fields based on type
    if (formData.recipientType === 'BUSINESS') {
      // Clear person fields when saving as Business
      savedData = {
        ...savedData,
        firstName: '',
        middleName: '',
        lastName: '',
        personAlias: '',
        birthdate: null,
        // Clear ID verification fields for business
        idType: null,
        idStateCountry: null,
        idExpirationDate: null,
        idVerifiedDate: null,
        idVerifiedBy: null,
      };
    } else {
      // Clear business fields when saving as Person
      savedData = {
        ...savedData,
        businessName: '',
        businessAlias: '',
      };
    }

    onSave(savedData);
  };

  const displayName = formData.recipientType === 'BUSINESS'
    ? formData.businessAlias
      ? `${formData.businessName} (DBA: ${formData.businessAlias})`
      : formData.businessName || 'New Business'
    : [
        formData.firstName,
        formData.middleName,
        formData.personAlias ? `"${formData.personAlias}"` : '',
        formData.lastName,
      ].filter(Boolean).join(' ') || 'New Recipient';

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
              Edit Recipient: {displayName}
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
            {/* Primary Account Holder Toggle */}
            {!recipient.isPrimary && recipient.id && (
              <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isPrimary}
                    onChange={(e) => setFormData({ ...formData, isPrimary: e.target.checked })}
                    className="rounded border-gray-300 text-postnet-red focus:ring-postnet-red h-4 w-4"
                  />
                  <div>
                    <span className="text-sm font-medium text-amber-800">Make Primary Account Holder</span>
                    <p className="text-xs text-amber-600">This will replace the current primary recipient</p>
                  </div>
                </label>
              </div>
            )}

            {/* Recipient Type Selector */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Recipient Type</h4>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="recipientType"
                    value="PERSON"
                    checked={formData.recipientType === 'PERSON'}
                    onChange={() => handleTypeChange('PERSON')}
                    className="text-postnet-red focus:ring-postnet-red"
                  />
                  <span className="text-sm">Person</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="recipientType"
                    value="BUSINESS"
                    checked={formData.recipientType === 'BUSINESS'}
                    onChange={() => handleTypeChange('BUSINESS')}
                    className="text-postnet-red focus:ring-postnet-red"
                  />
                  <span className="text-sm">Business</span>
                </label>
              </div>
            </div>

            {/* Name Section */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                {formData.recipientType === 'BUSINESS' ? 'Business Details' : 'Personal Details'}
              </h4>
              {formData.recipientType === 'BUSINESS' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Business Name</label>
                    <input
                      type="text"
                      value={formData.businessName}
                      onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                      className="w-full rounded-md border px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">DBA / Alias</label>
                    <input
                      type="text"
                      value={formData.businessAlias}
                      onChange={(e) => setFormData({ ...formData, businessAlias: e.target.value })}
                      className="w-full rounded-md border px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">First Name</label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full rounded-md border px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Middle Name</label>
                    <input
                      type="text"
                      value={formData.middleName}
                      onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
                      className="w-full rounded-md border px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Last Name</label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full rounded-md border px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Alias / Nickname</label>
                    <input
                      type="text"
                      value={formData.personAlias}
                      onChange={(e) => setFormData({ ...formData, personAlias: e.target.value })}
                      className="w-full rounded-md border px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Birthdate</label>
                    <input
                      type="date"
                      value={formData.birthdate ?? ''}
                      onChange={(e) => setFormData({ ...formData, birthdate: e.target.value || null })}
                      className="w-full rounded-md border px-3 py-2 text-sm"
                    />
                    {formData.birthdate && (() => {
                      const birth = new Date(formData.birthdate);
                      const today = new Date();
                      let age = today.getFullYear() - birth.getFullYear();
                      const monthDiff = today.getMonth() - birth.getMonth();
                      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
                        age--;
                      }
                      const isMinor = age < 18;
                      return (
                        <p className={`text-xs mt-1 ${isMinor ? 'text-amber-600' : 'text-gray-500'}`}>
                          Age: {age} {isMinor && '(Minor)'}
                        </p>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* ID Verification Section - Only for Person recipients */}
            {formData.recipientType === 'PERSON' && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">ID Verification</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">ID Type</label>
                    <select
                      value={formData.idType ?? ''}
                      onChange={(e) => setFormData({ ...formData, idType: e.target.value || null })}
                      className="w-full rounded-md border px-3 py-2 text-sm"
                    >
                      <option value="">Select ID type...</option>
                      {ID_TYPES.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">State / Country</label>
                    <input
                      type="text"
                      value={formData.idStateCountry ?? ''}
                      onChange={(e) => setFormData({ ...formData, idStateCountry: e.target.value || null })}
                      placeholder="e.g., CA, Guam, Philippines"
                      className="w-full rounded-md border px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">ID Expiration Date</label>
                    <input
                      type="date"
                      value={formData.idExpirationDate ?? ''}
                      onChange={(e) => setFormData({ ...formData, idExpirationDate: e.target.value || null })}
                      className="w-full rounded-md border px-3 py-2 text-sm"
                    />
                    {formData.idExpirationDate && (() => {
                      const expDate = new Date(formData.idExpirationDate);
                      const today = new Date();
                      const daysUntilExpiry = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      if (daysUntilExpiry < 0) {
                        return <p className="text-xs mt-1 text-red-600">ID Expired</p>;
                      } else if (daysUntilExpiry <= 30) {
                        return <p className="text-xs mt-1 text-amber-600">Expires in {daysUntilExpiry} days</p>;
                      }
                      return null;
                    })()}
                  </div>
                  <div className="flex items-center">
                    <label className="flex items-center gap-2 cursor-pointer mt-4">
                      <input
                        type="checkbox"
                        checked={!!formData.idVerifiedDate}
                        onChange={(e) => {
                          if (e.target.checked) {
                            // Set verified date to today and verifier to current user
                            const todayStr = new Date().toISOString().split('T')[0] as string;
                            const rawUserId = (session?.user as { id?: string } | undefined)?.id;
                            setFormData({
                              ...formData,
                              idVerifiedDate: todayStr,
                              idVerifiedBy: typeof rawUserId === 'string' ? rawUserId : null,
                            });
                          } else {
                            // Clear verification
                            setFormData({
                              ...formData,
                              idVerifiedDate: null,
                              idVerifiedBy: null,
                            });
                          }
                        }}
                        className="rounded border-gray-300 text-postnet-red focus:ring-postnet-red h-4 w-4"
                      />
                      <span className="text-sm text-gray-700">ID Verified</span>
                    </label>
                  </div>
                </div>
                {formData.idVerifiedDate && (
                  <p className="text-xs text-green-600 mt-2">
                    Verified on {formData.idVerifiedDate}
                  </p>
                )}
              </div>
            )}

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
                      <select
                        value={getLabelSelectValue(phone.label)}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === 'Other') {
                            // Keep existing custom label if already custom, otherwise set empty
                            updatePhone(index, { label: isCustomLabel(phone.label) ? phone.label : '' });
                          } else {
                            updatePhone(index, { label: value });
                          }
                        }}
                        className="w-24 rounded-md border px-2 py-1 text-sm"
                      >
                        <option value="">Label</option>
                        {PHONE_LABEL_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      {getLabelSelectValue(phone.label) === 'Other' && (
                        <input
                          type="text"
                          value={phone.label}
                          onChange={(e) => updatePhone(index, { label: e.target.value })}
                          placeholder="Custom label"
                          className="w-24 rounded-md border px-2 py-1 text-sm"
                        />
                      )}
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
                      <select
                        value={getLabelSelectValue(email.label)}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === 'Other') {
                            // Keep existing custom label if already custom, otherwise set empty
                            updateEmail(index, { label: isCustomLabel(email.label) ? email.label : '' });
                          } else {
                            updateEmail(index, { label: value });
                          }
                        }}
                        className="w-24 rounded-md border px-2 py-1 text-sm"
                      >
                        <option value="">Label</option>
                        {EMAIL_LABEL_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      {getLabelSelectValue(email.label) === 'Other' && (
                        <input
                          type="text"
                          value={email.label}
                          onChange={(e) => updateEmail(index, { label: e.target.value })}
                          placeholder="Custom label"
                          className="w-24 rounded-md border px-2 py-1 text-sm"
                        />
                      )}
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
