'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { AppLayout } from '@/components/layout';
import { formatPhoneForInput, parsePhoneToE164 } from '@/lib/utils/phone';
import { isMinor as checkIsMinor } from '@/lib/utils/date';

interface Mailbox {
  id: string;
  number: number;
}

interface FormData {
  mailboxId: string;
  recipientType: 'PERSON' | 'BUSINESS';
  firstName: string;
  middleName: string;
  lastName: string;
  personAlias: string;
  birthdate: string;
  businessName: string;
  businessAlias: string;
  phone: string;
  email: string;
  renewalPeriod: 'THREE_MONTH' | 'SIX_MONTH' | 'TWELVE_MONTH';
  monthlyRate: string;
  startDate: string;
  depositPaid: string;
  smsEnabled: boolean;
  emailEnabled: boolean;
}

const PERIOD_MONTHS: Record<string, number> = {
  THREE_MONTH: 3,
  SIX_MONTH: 6,
  TWELVE_MONTH: 12,
};

const PERIOD_LABELS: Record<string, string> = {
  THREE_MONTH: '3 Months',
  SIX_MONTH: '6 Months',
  TWELVE_MONTH: '12 Months (13 months for price of 12)',
};

interface PriceBreakdown {
  baseRate: number;
  businessFee: number;
  additionalRecipientFees: number;
  minorFees: number;
  totalMonthly: number;
  totalForPeriod: number;
  periodMonths: number;
}

function NewAccountForm(): React.ReactElement {
  const router = useRouter();
  const { data: session } = useSession();
  const isManager = session?.user?.role === 'MANAGER';

  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mailboxSearch, setMailboxSearch] = useState('');

  // Pricing state
  const [calculatedRate, setCalculatedRate] = useState<PriceBreakdown | null>(null);
  const [isRateOverridden, setIsRateOverridden] = useState(false);
  const [isCalculatingRate, setIsCalculatingRate] = useState(false);

  const today = new Date().toISOString().split('T')[0] ?? '';
  const [formData, setFormData] = useState<FormData>({
    mailboxId: '',
    recipientType: 'PERSON',
    firstName: '',
    middleName: '',
    lastName: '',
    personAlias: '',
    birthdate: '',
    businessName: '',
    businessAlias: '',
    phone: '',
    email: '',
    renewalPeriod: 'THREE_MONTH',
    monthlyRate: '',
    startDate: today,
    depositPaid: '5.00',
    smsEnabled: false,
    emailEnabled: false,
  });

  // Fetch available mailboxes
  useEffect(() => {
    const fetchMailboxes = async (): Promise<void> => {
      try {
        const res = await fetch('/api/mailboxes?status=AVAILABLE&limit=2000');
        if (!res.ok) throw new Error('Failed to fetch mailboxes');
        const json = await res.json() as { data: Mailbox[] };
        setMailboxes(json.data);
      } catch {
        setError('Failed to load available mailboxes');
      } finally {
        setLoading(false);
      }
    };
    void fetchMailboxes();
  }, []);

  // Calculate pricing when renewal period or birthdate changes
  const calculatePricing = useCallback(async (): Promise<void> => {
    setIsCalculatingRate(true);
    try {
      // Determine recipient counts (primary is always a person)
      let adultRecipientCount = 0;
      let minorRecipientCount = 0;

      // Check if minor based on birthdate
      if (formData.birthdate) {
        const birthdateObj = new Date(formData.birthdate);
        if (checkIsMinor(birthdateObj)) {
          minorRecipientCount = 1;
        } else {
          adultRecipientCount = 1;
        }
      } else {
        // No birthdate = assume adult
        adultRecipientCount = 1;
      }

      const res = await fetch('/api/pricing/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          renewalPeriod: formData.renewalPeriod,
          adultRecipientCount,
          minorRecipientCount,
          hasBusinessRecipient: false, // Primary recipient is always a person
        }),
      });

      if (res.ok) {
        const response = await res.json() as { success: boolean; data: PriceBreakdown };
        const breakdown = response.data;
        setCalculatedRate(breakdown);

        // Auto-set monthly rate if not overridden
        if (!isRateOverridden) {
          setFormData((prev) => ({
            ...prev,
            monthlyRate: breakdown.totalMonthly.toFixed(2),
          }));
        }
      }
    } catch {
      // Silently fail - user can still enter rate manually
      console.error('Failed to calculate pricing');
    } finally {
      setIsCalculatingRate(false);
    }
  }, [formData.renewalPeriod, formData.birthdate, isRateOverridden]);

  useEffect(() => {
    void calculatePricing();
  }, [calculatePricing]);

  // Calculate total rate
  const monthlyRate = parseFloat(formData.monthlyRate) || 0;
  const months = PERIOD_MONTHS[formData.renewalPeriod] ?? 3;
  const totalRate = monthlyRate * months;

  // Filter mailboxes by search
  const filteredMailboxes = mailboxSearch
    ? mailboxes.filter((m) => m.number.toString().includes(mailboxSearch))
    : mailboxes;

  const handlePhoneBlur = (): void => {
    const formatted = formatPhoneForInput(formData.phone);
    if (formatted !== formData.phone) {
      setFormData({ ...formData, phone: formatted });
    }
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      // Validate
      if (!formData.mailboxId) {
        throw new Error('Please select a mailbox');
      }
      if (!formData.monthlyRate || parseFloat(formData.monthlyRate) <= 0) {
        throw new Error('Please enter a valid monthly rate');
      }
      if (formData.recipientType === 'PERSON' && !formData.firstName) {
        throw new Error('First name is required');
      }
      if (formData.recipientType === 'BUSINESS' && !formData.businessName) {
        throw new Error('Business name is required');
      }

      const payload = {
        mailboxId: formData.mailboxId,
        renewalPeriod: formData.renewalPeriod,
        monthlyRate: parseFloat(formData.monthlyRate),
        startDate: formData.startDate,
        depositPaid: parseFloat(formData.depositPaid) || 5.00,
        smsEnabled: formData.smsEnabled,
        emailEnabled: formData.emailEnabled,
        recipient: {
          recipientType: formData.recipientType,
          firstName: formData.recipientType === 'PERSON' ? formData.firstName : undefined,
          middleName: formData.recipientType === 'PERSON' ? formData.middleName || undefined : undefined,
          lastName: formData.recipientType === 'PERSON' ? formData.lastName || undefined : undefined,
          personAlias: formData.recipientType === 'PERSON' ? formData.personAlias || undefined : undefined,
          birthdate: formData.recipientType === 'PERSON' && formData.birthdate ? formData.birthdate : undefined,
          businessName: formData.recipientType === 'BUSINESS' ? formData.businessName : undefined,
          businessAlias: formData.recipientType === 'BUSINESS' ? formData.businessAlias || undefined : undefined,
          phone: formData.phone ? parsePhoneToE164(formData.phone) : undefined,
          email: formData.email || undefined,
        },
      };

      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Failed to create account');
      }

      const result = await res.json() as { id: string; mailboxNumber: number };
      router.push(`/accounts/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const selectedMailbox = mailboxes.find((m) => m.id === formData.mailboxId);

  return (
    <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => router.push('/accounts')}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back to Accounts
          </button>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">New Account</h1>

        {error && (
          <div className="mb-6 rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Mailbox Selection */}
          <section className="bg-white rounded-lg border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Mailbox</h2>
            {loading ? (
              <p className="text-gray-500">Loading available mailboxes...</p>
            ) : (
              <div>
                <input
                  type="text"
                  placeholder="Search by mailbox number..."
                  value={mailboxSearch}
                  onChange={(e) => setMailboxSearch(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm mb-3"
                />
                <div className="max-h-48 overflow-y-auto border rounded-md">
                  {filteredMailboxes.length === 0 ? (
                    <p className="p-3 text-gray-500 text-sm">No available mailboxes found</p>
                  ) : (
                    filteredMailboxes.slice(0, 100).map((mailbox) => (
                      <label
                        key={mailbox.id}
                        className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 border-b last:border-b-0 ${
                          formData.mailboxId === mailbox.id ? 'bg-red-50' : ''
                        }`}
                      >
                        <input
                          type="radio"
                          name="mailbox"
                          value={mailbox.id}
                          checked={formData.mailboxId === mailbox.id}
                          onChange={() => setFormData({ ...formData, mailboxId: mailbox.id })}
                          className="text-postnet-red focus:ring-postnet-red"
                        />
                        <span className="font-mono font-medium">{mailbox.number}</span>
                      </label>
                    ))
                  )}
                  {filteredMailboxes.length > 100 && (
                    <p className="p-2 text-xs text-gray-400 text-center">
                      Showing first 100 results. Use search to find specific mailbox.
                    </p>
                  )}
                </div>
                {selectedMailbox && (
                  <p className="mt-2 text-sm text-green-600">
                    Selected: Mailbox #{selectedMailbox.number}
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Primary Recipient (always a person) */}
          <section className="bg-white rounded-lg border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Primary Recipient</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">First Name *</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  required
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
                  value={formData.birthdate}
                  onChange={(e) => setFormData({ ...formData, birthdate: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
            </div>

            {/* Contact Info */}
            <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => {
                    const newPhone = e.target.value;
                    const wasEmpty = !formData.phone;
                    setFormData({
                      ...formData,
                      phone: newPhone,
                      // Enable SMS when phone is first added, disable if cleared
                      smsEnabled: newPhone ? (wasEmpty ? true : formData.smsEnabled) : false,
                    });
                  }}
                  onBlur={handlePhoneBlur}
                  placeholder="+1 671 ___-____"
                  className="w-full rounded-md border px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => {
                    const newEmail = e.target.value;
                    const wasEmpty = !formData.email;
                    setFormData({
                      ...formData,
                      email: newEmail,
                      // Enable email when first added, disable if cleared
                      emailEnabled: newEmail ? (wasEmpty ? true : formData.emailEnabled) : false,
                    });
                  }}
                  placeholder="email@example.com"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
            </div>
          </section>

          {/* Account Settings */}
          <section className="bg-white rounded-lg border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Settings</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Renewal Period *</label>
                <select
                  value={formData.renewalPeriod}
                  onChange={(e) => setFormData({ ...formData, renewalPeriod: e.target.value as FormData['renewalPeriod'] })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="THREE_MONTH">{PERIOD_LABELS.THREE_MONTH}</option>
                  <option value="SIX_MONTH">{PERIOD_LABELS.SIX_MONTH}</option>
                  <option value="TWELVE_MONTH">{PERIOD_LABELS.TWELVE_MONTH}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Monthly Rate *
                  {isCalculatingRate && <span className="ml-2 text-gray-400">(calculating...)</span>}
                </label>
                <div className="relative">
                  <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${!isRateOverridden ? 'text-gray-400' : 'text-gray-600'}`}>$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.monthlyRate}
                    onChange={(e) => setFormData({ ...formData, monthlyRate: e.target.value })}
                    className={`w-full rounded-md border pl-7 pr-3 py-2 text-sm ${
                      !isRateOverridden ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
                    }`}
                    placeholder="0.00"
                    required
                    disabled={!isRateOverridden}
                  />
                </div>
                {/* Manager override toggle */}
                {isManager && calculatedRate && (
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isRateOverridden}
                      onChange={(e) => {
                        setIsRateOverridden(e.target.checked);
                        // Reset to calculated rate when unchecking
                        if (!e.target.checked && calculatedRate) {
                          setFormData((prev) => ({
                            ...prev,
                            monthlyRate: calculatedRate.totalMonthly.toFixed(2),
                          }));
                        }
                      }}
                      className="rounded border-gray-300 text-postnet-red focus:ring-postnet-red"
                    />
                    <span className="text-xs text-gray-500">Override calculated rate</span>
                  </label>
                )}
              </div>
              <div className="col-span-2">
                <div className="bg-gray-50 rounded-md p-3 text-sm space-y-1">
                  {/* Pricing breakdown */}
                  {calculatedRate && (
                    <div className="text-xs text-gray-500 space-y-0.5 pb-2 border-b border-gray-200 mb-2">
                      <div className="flex justify-between">
                        <span>Base rate ({months} mo):</span>
                        <span className="font-mono">${calculatedRate.baseRate.toFixed(2)}</span>
                      </div>
                      {calculatedRate.businessFee > 0 && (
                        <div className="flex justify-between">
                          <span>Business account fee:</span>
                          <span className="font-mono">${calculatedRate.businessFee.toFixed(2)}</span>
                        </div>
                      )}
                      {calculatedRate.minorFees > 0 && (
                        <div className="flex justify-between">
                          <span>Minor recipient fee:</span>
                          <span className="font-mono">${calculatedRate.minorFees.toFixed(2)}</span>
                        </div>
                      )}
                      {calculatedRate.additionalRecipientFees > 0 && (
                        <div className="flex justify-between">
                          <span>Additional recipient fees:</span>
                          <span className="font-mono">${calculatedRate.additionalRecipientFees.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-gray-600">Total for {months} months:</span>
                      {formData.renewalPeriod === 'TWELVE_MONTH' && (
                        <span className="text-green-600 text-xs ml-2">(+1 free month)</span>
                      )}
                    </div>
                    <span className="font-semibold">${totalRate.toFixed(2)}</span>
                  </div>
                  {formData.renewalPeriod === 'TWELVE_MONTH' && totalRate > 0 && (
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Effective monthly rate (13 mo):</span>
                      <span className="font-mono">${(totalRate / 13).toFixed(2)}/mo</span>
                    </div>
                  )}
                  {isRateOverridden && calculatedRate && (
                    <div className="text-xs text-amber-600 mt-1">
                      Rate overridden. Calculated: ${(calculatedRate.totalMonthly * months).toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Deposit Paid</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.depositPaid}
                    onChange={(e) => setFormData({ ...formData, depositPaid: e.target.value })}
                    className="w-full rounded-md border pl-7 pr-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t flex gap-6">
              <label className={`flex items-center gap-2 ${formData.phone ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                <input
                  type="checkbox"
                  checked={formData.smsEnabled}
                  onChange={(e) => setFormData({ ...formData, smsEnabled: e.target.checked })}
                  disabled={!formData.phone}
                  className="rounded border-gray-300 text-postnet-red focus:ring-postnet-red disabled:opacity-50"
                />
                <span className="text-sm">Enable SMS Notifications</span>
              </label>
              <label className={`flex items-center gap-2 ${formData.email ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                <input
                  type="checkbox"
                  checked={formData.emailEnabled}
                  onChange={(e) => setFormData({ ...formData, emailEnabled: e.target.checked })}
                  disabled={!formData.email}
                  className="rounded border-gray-300 text-postnet-red focus:ring-postnet-red disabled:opacity-50"
                />
                <span className="text-sm">Enable Email Notifications</span>
              </label>
            </div>
          </section>

          {/* Submit */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.push('/accounts')}
              className="rounded-md border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !formData.mailboxId}
              className="rounded-md bg-postnet-red px-6 py-2 text-sm text-white hover:bg-postnet-red-dark disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>
    </div>
  );
}

export default function NewAccountPage(): React.ReactElement {
  return (
    <AppLayout>
      <NewAccountForm />
    </AppLayout>
  );
}
