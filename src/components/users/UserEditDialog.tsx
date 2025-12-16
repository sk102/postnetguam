'use client';

import { useState, useEffect } from 'react';
import { PASSWORD } from '@/constants/app';
import { formatPhoneForInput, parsePhoneToE164 } from '@/lib/utils/phone';

interface PhoneNumberData {
  id?: string;
  e164Format: string;
  isMobile: boolean;
  isPrimary: boolean;
}

interface EmailAddressData {
  id?: string;
  email: string;
  isPrimary: boolean;
}

export interface UserEditData {
  username: string;
  email: string;
  firstName: string;
  middleName: string;
  lastName: string;
  role: 'STAFF' | 'MANAGER';
  password: string;
  isActive: boolean;
  phoneNumbers: PhoneNumberData[];
  emailAddresses: EmailAddressData[];
}

export interface UserForEdit {
  id: string;
  username: string;
  email: string;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  role: 'STAFF' | 'MANAGER';
  isActive: boolean;
  phoneNumbers?: PhoneNumberData[];
  emailAddresses?: EmailAddressData[];
}

interface UserEditDialogProps {
  isOpen: boolean;
  user: UserForEdit | null; // null = create mode
  onClose: () => void;
  onSave: (data: UserEditData) => void;
  isSaving?: boolean;
}

const INITIAL_FORM_DATA: UserEditData = {
  username: '',
  email: '',
  firstName: '',
  middleName: '',
  lastName: '',
  role: 'STAFF',
  password: '',
  isActive: true,
  phoneNumbers: [],
  emailAddresses: [],
};

export function UserEditDialog({
  isOpen,
  user,
  onClose,
  onSave,
  isSaving = false,
}: UserEditDialogProps): React.ReactElement | null {
  const [formData, setFormData] = useState<UserEditData>(INITIAL_FORM_DATA);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Local state for phone/email inputs (display format)
  const [phoneInputs, setPhoneInputs] = useState<Array<{ value: string; isMobile: boolean; isPrimary: boolean }>>([]);
  const [emailInputs, setEmailInputs] = useState<Array<{ value: string; isPrimary: boolean }>>([]);

  const isEditMode = user !== null;

  useEffect(() => {
    if (isOpen) {
      if (user) {
        setFormData({
          username: user.username,
          email: user.email,
          firstName: user.firstName ?? '',
          middleName: user.middleName ?? '',
          lastName: user.lastName ?? '',
          role: user.role,
          password: '',
          isActive: user.isActive,
          phoneNumbers: user.phoneNumbers ?? [],
          emailAddresses: user.emailAddresses ?? [],
        });
        // Set display-formatted phone inputs
        setPhoneInputs(
          (user.phoneNumbers ?? []).map((p) => ({
            value: formatPhoneForInput(p.e164Format),
            isMobile: p.isMobile,
            isPrimary: p.isPrimary,
          }))
        );
        setEmailInputs(
          (user.emailAddresses ?? []).map((e) => ({
            value: e.email,
            isPrimary: e.isPrimary,
          }))
        );
      } else {
        setFormData(INITIAL_FORM_DATA);
        setPhoneInputs([]);
        setEmailInputs([]);
      }
      setConfirmPassword('');
      setErrors({});
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Login email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    // Password required for create, optional for edit
    if (!isEditMode && !formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password && formData.password.length < PASSWORD.MIN_LENGTH) {
      newErrors.password = `Password must be at least ${PASSWORD.MIN_LENGTH} characters`;
    }

    if (formData.password && formData.password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = (): void => {
    if (validate()) {
      // Convert phone inputs to E164 format
      const phoneNumbers = phoneInputs
        .filter((p) => p.value.trim())
        .map((p) => ({
          e164Format: parsePhoneToE164(p.value) ?? p.value,
          isMobile: p.isMobile,
          isPrimary: p.isPrimary,
        }));

      const emailAddresses = emailInputs
        .filter((e) => e.value.trim())
        .map((e) => ({
          email: e.value.toLowerCase(),
          isPrimary: e.isPrimary,
        }));

      onSave({
        ...formData,
        phoneNumbers,
        emailAddresses,
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const addPhone = (): void => {
    const hasPrimary = phoneInputs.some((p) => p.isPrimary);
    setPhoneInputs([...phoneInputs, { value: '', isMobile: true, isPrimary: !hasPrimary }]);
  };

  const removePhone = (index: number): void => {
    const newPhones = phoneInputs.filter((_, i) => i !== index);
    // If we removed the primary and there are others, make the first one primary
    if (phoneInputs[index]?.isPrimary && newPhones.length > 0 && newPhones[0]) {
      newPhones[0].isPrimary = true;
    }
    setPhoneInputs(newPhones);
  };

  const updatePhone = (index: number, updates: Partial<{ value: string; isMobile: boolean; isPrimary: boolean }>): void => {
    const newPhones = [...phoneInputs];
    const phone = newPhones[index];
    if (!phone) return;

    // If setting this as primary, unset others
    if (updates.isPrimary) {
      newPhones.forEach((p, i) => {
        if (i !== index) p.isPrimary = false;
      });
    }

    newPhones[index] = { ...phone, ...updates };
    setPhoneInputs(newPhones);
  };

  const addEmail = (): void => {
    const hasPrimary = emailInputs.some((e) => e.isPrimary);
    setEmailInputs([...emailInputs, { value: '', isPrimary: !hasPrimary }]);
  };

  const removeEmail = (index: number): void => {
    const newEmails = emailInputs.filter((_, i) => i !== index);
    if (emailInputs[index]?.isPrimary && newEmails.length > 0 && newEmails[0]) {
      newEmails[0].isPrimary = true;
    }
    setEmailInputs(newEmails);
  };

  const updateEmail = (index: number, updates: Partial<{ value: string; isPrimary: boolean }>): void => {
    const newEmails = [...emailInputs];
    const email = newEmails[index];
    if (!email) return;

    if (updates.isPrimary) {
      newEmails.forEach((e, i) => {
        if (i !== index) e.isPrimary = false;
      });
    }

    newEmails[index] = { ...email, ...updates };
    setEmailInputs(newEmails);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" onKeyDown={handleKeyDown}>
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Dialog */}
        <div className="relative w-full max-w-lg rounded-lg bg-white shadow-xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b px-6 py-4 bg-white">
            <h3 className="text-lg font-semibold text-gray-900">
              {isEditMode ? 'Edit User' : 'Add User'}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
              disabled={isSaving}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-4 space-y-6">
            {/* Account Section */}
            <section>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Account</h4>
              <div className="space-y-4">
                {/* Username */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className={`w-full rounded-md border px-3 py-2 text-sm ${errors.username ? 'border-red-500' : ''}`}
                    disabled={isSaving}
                  />
                  {errors.username && <p className="mt-1 text-sm text-red-500">{errors.username}</p>}
                </div>

                {/* Login Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Login Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`w-full rounded-md border px-3 py-2 text-sm ${errors.email ? 'border-red-500' : ''}`}
                    disabled={isSaving}
                  />
                  {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
                </div>

                {/* Role */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as 'STAFF' | 'MANAGER' })}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    disabled={isSaving}
                  >
                    <option value="STAFF">Staff</option>
                    <option value="MANAGER">Manager</option>
                  </select>
                </div>

                {/* Password */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password {!isEditMode && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className={`w-full rounded-md border px-3 py-2 text-sm ${errors.password ? 'border-red-500' : ''}`}
                      disabled={isSaving}
                      autoComplete="new-password"
                      placeholder={isEditMode ? '(unchanged)' : ''}
                    />
                    {errors.password && <p className="mt-1 text-sm text-red-500">{errors.password}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full rounded-md border px-3 py-2 text-sm ${errors.confirmPassword ? 'border-red-500' : ''}`}
                      disabled={isSaving}
                      autoComplete="new-password"
                    />
                    {errors.confirmPassword && <p className="mt-1 text-sm text-red-500">{errors.confirmPassword}</p>}
                  </div>
                </div>
              </div>
            </section>

            {/* Personal Info Section */}
            <section>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Personal Information</h4>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">First Name</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    disabled={isSaving}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Middle Name</label>
                  <input
                    type="text"
                    value={formData.middleName}
                    onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    disabled={isSaving}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    disabled={isSaving}
                  />
                </div>
              </div>
            </section>

            {/* Phone Numbers Section */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-700">Phone Numbers</h4>
                <button
                  type="button"
                  onClick={addPhone}
                  className="text-xs text-postnet-red hover:text-postnet-red-dark"
                  disabled={isSaving}
                >
                  + Add Phone
                </button>
              </div>
              {phoneInputs.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No phone numbers</p>
              ) : (
                <div className="space-y-2">
                  {phoneInputs.map((phone, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="tel"
                        value={phone.value}
                        onChange={(e) => updatePhone(index, { value: e.target.value })}
                        onBlur={() => updatePhone(index, { value: formatPhoneForInput(phone.value) })}
                        placeholder="+1 671 ___-____"
                        className="flex-1 rounded-md border px-3 py-1.5 text-sm font-mono"
                        disabled={isSaving}
                      />
                      <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={phone.isMobile}
                          onChange={(e) => updatePhone(index, { isMobile: e.target.checked })}
                          className="rounded border-gray-300 text-postnet-red text-xs"
                          disabled={isSaving}
                        />
                        Mobile
                      </label>
                      <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer whitespace-nowrap">
                        <input
                          type="radio"
                          name="primaryPhone"
                          checked={phone.isPrimary}
                          onChange={() => updatePhone(index, { isPrimary: true })}
                          className="border-gray-300 text-postnet-red"
                          disabled={isSaving}
                        />
                        Primary
                      </label>
                      <button
                        type="button"
                        onClick={() => removePhone(index)}
                        className="text-red-500 hover:text-red-700"
                        disabled={isSaving}
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Email Addresses Section */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-700">Additional Email Addresses</h4>
                <button
                  type="button"
                  onClick={addEmail}
                  className="text-xs text-postnet-red hover:text-postnet-red-dark"
                  disabled={isSaving}
                >
                  + Add Email
                </button>
              </div>
              {emailInputs.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No additional email addresses</p>
              ) : (
                <div className="space-y-2">
                  {emailInputs.map((email, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="email"
                        value={email.value}
                        onChange={(e) => updateEmail(index, { value: e.target.value })}
                        placeholder="email@example.com"
                        className="flex-1 rounded-md border px-3 py-1.5 text-sm"
                        disabled={isSaving}
                      />
                      <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer whitespace-nowrap">
                        <input
                          type="radio"
                          name="primaryEmail"
                          checked={email.isPrimary}
                          onChange={() => updateEmail(index, { isPrimary: true })}
                          className="border-gray-300 text-postnet-red"
                          disabled={isSaving}
                        />
                        Primary
                      </label>
                      <button
                        type="button"
                        onClick={() => removeEmail(index)}
                        className="text-red-500 hover:text-red-700"
                        disabled={isSaving}
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Active Toggle (edit mode only) */}
            {isEditMode && (
              <section>
                <div className="flex items-center justify-between pt-2">
                  <label className="text-sm font-medium text-gray-700">Active Status</label>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-postnet-red focus:ring-offset-2 ${
                      formData.isActive ? 'bg-postnet-red' : 'bg-gray-200'
                    }`}
                    disabled={isSaving}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        formData.isActive ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </section>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 flex justify-end gap-3 border-t px-6 py-4 bg-white">
            <button
              onClick={onClose}
              className="rounded-md border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="rounded-md bg-postnet-red px-4 py-2 text-sm text-white hover:bg-postnet-red-dark disabled:opacity-50"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
