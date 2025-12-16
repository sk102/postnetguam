'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout';
import { RecipientEditDialog } from '@/components/accounts/RecipientEditDialog';
import { AccountEditDialog } from '@/components/accounts/AccountEditDialog';
import { MailboxReassignDialog } from '@/components/accounts/MailboxReassignDialog';
import { format } from 'date-fns';
import { formatPhone } from '@/lib/utils/phone';

interface PhoneNumber {
  id: string;
  phone: string;
  isMobile: boolean;
  isPrimary: boolean;
  label: string | null;
}

interface EmailAddress {
  id: string;
  email: string;
  isPrimary: boolean;
  label: string | null;
}

interface Recipient {
  id: string;
  isPrimary: boolean;
  recipientType: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  personAlias: string | null;
  birthdate: string | null;
  businessName: string | null;
  businessAlias: string | null;
  name: string;
  idType: string | null;
  idStateCountry: string | null;
  idExpirationDate: string | null;
  idVerifiedDate: string | null;
  idVerifiedBy: string | null;
  contactCardId: string | null;
  phoneNumbers: PhoneNumber[];
  emailAddresses: EmailAddress[];
}

interface AccountDetail {
  id: string;
  status: string;
  renewalPeriod: string;
  startDate: string;
  lastRenewalDate: string | null;
  nextRenewalDate: string;
  currentRate: string;
  depositPaid: string;
  depositReturned: boolean;
  smsEnabled: boolean;
  emailEnabled: boolean;
  closedAt: string | null;
  closureReason: string | null;
  auditFlag: boolean;
  auditNote: string | null;
  auditedAt: string | null;
  mailbox: {
    id: string;
    number: number;
    status: string;
    keyDeposit: string;
  };
  recipients: Recipient[];
  primaryRecipient: {
    id: string;
    contactCardId: string | null;
    recipientType: string;
    firstName: string | null;
    lastName: string | null;
    businessName: string | null;
  } | null;
  phoneNumbers: PhoneNumber[];
  emailAddresses: EmailAddress[];
}

interface FormPhoneNumber {
  id?: string;
  phone: string;
  isMobile: boolean;
  isPrimary: boolean;
  label: string;
  _delete?: boolean;
  _isNew?: boolean;
}

interface FormEmailAddress {
  id?: string;
  email: string;
  isPrimary: boolean;
  label: string;
  _delete?: boolean;
  _isNew?: boolean;
}

interface FormRecipient {
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
  contactCardId?: string;
  phoneNumbers: FormPhoneNumber[];
  emailAddresses: FormEmailAddress[];
  _delete?: boolean;
  _isNew?: boolean;
}

interface NoticeType {
  id: string;
  code: string;
  name: string;
}

function StatusBadge({ status }: { status: string }): React.ReactElement {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-status-active/10 text-status-active',
    RENEWAL: 'bg-status-renewal/10 text-status-renewal',
    HOLD: 'bg-status-hold/10 text-status-hold',
    CLOSED: 'bg-status-closed/10 text-status-closed',
  };
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${colors[status] ?? 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}

function BackIcon(): React.ReactElement {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
    </svg>
  );
}

function EditIcon(): React.ReactElement {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
    </svg>
  );
}

function formatRenewalPeriod(period: string): string {
  const labels: Record<string, string> = {
    THREE_MONTH: '3 Months',
    SIX_MONTH: '6 Months',
    TWELVE_MONTH: '12 Months',
  };
  return labels[period] ?? period;
}

function BusinessNameDisplay({ name, alias }: { name: string; alias?: string | null }): React.ReactElement {
  if (alias) {
    return (
      <>
        {name} <span className="text-gray-500">(DBA:</span> <span className="font-bold">{alias}</span><span className="text-gray-500">)</span>
      </>
    );
  }
  return <>{name}</>;
}

function RecipientNameDisplay({ recipient }: { recipient: FormRecipient }): React.ReactElement {
  if (recipient.recipientType === 'BUSINESS') {
    const name = recipient.businessName || 'New Business';
    return <BusinessNameDisplay name={name} alias={recipient.businessAlias} />;
  }
  const personName = [
    recipient.firstName,
    recipient.middleName,
    recipient.personAlias ? `"${recipient.personAlias}"` : '',
    recipient.lastName,
  ].filter(Boolean).join(' ') || 'New Recipient';
  return <>{personName}</>;
}

function AccountDetailContent(): React.ReactElement {
  const params = useParams();
  const router = useRouter();
  const accountId = params.id as string;

  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Dialog states
  const [accountEditOpen, setAccountEditOpen] = useState(false);
  const [mailboxEditOpen, setMailboxEditOpen] = useState(false);
  const [editingRecipientIndex, setEditingRecipientIndex] = useState<number | null>(null);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);

  // Recipients state for managing additions/deletions
  const [recipients, setRecipients] = useState<FormRecipient[]>([]);

  // Notice generation state
  const [noticeTypes, setNoticeTypes] = useState<NoticeType[]>([]);
  const [generatingNotice, setGeneratingNotice] = useState<string | null>(null);

  const fetchAccount = useCallback(async () => {
    try {
      const res = await fetch(`/api/accounts/${accountId}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError('Account not found');
          return;
        }
        throw new Error('Failed to fetch account');
      }
      const data = await res.json() as AccountDetail;
      setAccount(data);
      // Map recipients for editing - each recipient has their own contact info
      setRecipients(data.recipients.map((r) => ({
        id: r.id,
        isPrimary: r.isPrimary,
        recipientType: r.recipientType,
        firstName: r.firstName ?? '',
        middleName: r.middleName ?? '',
        lastName: r.lastName ?? '',
        personAlias: r.personAlias ?? '',
        birthdate: r.birthdate ?? null,
        businessName: r.businessName ?? '',
        businessAlias: r.businessAlias ?? '',
        idType: r.idType ?? null,
        idStateCountry: r.idStateCountry ?? null,
        idExpirationDate: r.idExpirationDate ?? null,
        idVerifiedDate: r.idVerifiedDate ?? null,
        idVerifiedBy: r.idVerifiedBy ?? null,
        ...(r.contactCardId ? { contactCardId: r.contactCardId } : {}),
        phoneNumbers: r.phoneNumbers.map((p) => ({
          id: p.id,
          phone: p.phone,
          isMobile: p.isMobile,
          isPrimary: p.isPrimary,
          label: p.label ?? '',
        })),
        emailAddresses: r.emailAddresses.map((e) => ({
          id: e.id,
          email: e.email,
          isPrimary: e.isPrimary,
          label: e.label ?? '',
        })),
      })));
    } catch {
      setError('Failed to load account details');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    void fetchAccount();
  }, [fetchAccount]);

  // Fetch notice types on mount
  useEffect(() => {
    const fetchNoticeTypes = async (): Promise<void> => {
      try {
        const res = await fetch('/api/notices/types');
        if (res.ok) {
          const data = await res.json() as { data: NoticeType[] };
          setNoticeTypes(data.data);
        }
      } catch {
        // Silently fail - notices are optional
      }
    };
    void fetchNoticeTypes();
  }, []);

  // Generate a notice and open PDF
  const generateNotice = async (noticeTypeCode: string, recipientIds?: string[]): Promise<void> => {
    if (noticeTypes.length === 0) {
      setError('Notice types not loaded. Please refresh the page.');
      return;
    }
    const noticeType = noticeTypes.find((t) => t.code === noticeTypeCode);
    if (!noticeType) {
      setError(`Notice type "${noticeTypeCode}" not found. Please ensure notice types are seeded.`);
      return;
    }

    setGeneratingNotice(noticeTypeCode);
    setError(null);

    try {
      const res = await fetch('/api/notices/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noticeTypeId: noticeType.id,
          accountIds: [accountId],
          deliveryMethod: 'PRINT',
          ...(recipientIds && { recipientIds }),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json() as { error?: string };
        throw new Error(errorData.error ?? 'Failed to generate notice');
      }

      const result = await res.json() as {
        results: Array<{ success: boolean; noticeHistoryId?: string; error?: string }>;
        successful: number;
      };

      if (result.successful > 0 && result.results[0]?.noticeHistoryId) {
        // Open PDF in new tab
        window.open(`/api/notices/${result.results[0].noticeHistoryId}/pdf`, '_blank');
        setSuccessMessage('Notice generated successfully');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else if (result.results[0]?.error) {
        throw new Error(result.results[0].error);
      } else {
        throw new Error('Failed to generate notice - no result returned');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate notice');
    } finally {
      setGeneratingNotice(null);
    }
  };

  // Save account info (status, period, rate, dates, notifications)
  const handleAccountSave = async (data: {
    status: string;
    renewalPeriod: string;
    currentRate: string;
    nextRenewalDate: string;
    smsEnabled: boolean;
    emailEnabled: boolean;
  }): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounts/${accountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errorData = await res.json() as { error?: string };
        throw new Error(errorData.error ?? 'Failed to save');
      }
      await fetchAccount();
      setAccountEditOpen(false);
      setSuccessMessage('Account updated successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // Save mailbox reassignment
  const handleMailboxSave = async (mailboxId: string): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounts/${accountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mailboxId }),
      });
      if (!res.ok) {
        const errorData = await res.json() as { error?: string };
        throw new Error(errorData.error ?? 'Failed to reassign mailbox');
      }
      await fetchAccount();
      setMailboxEditOpen(false);
      setSuccessMessage('Mailbox reassigned successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reassign mailbox');
    } finally {
      setSaving(false);
    }
  };

  // Save recipient changes
  const handleRecipientSave = async (data: {
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
    phoneNumbers: FormPhoneNumber[];
    emailAddresses: FormEmailAddress[];
  }): Promise<void> => {
    if (editingRecipientIndex === null) return;

    const recipient = recipients[editingRecipientIndex];
    if (!recipient) return;

    setSaving(true);
    setError(null);
    try {
      // Use the contactCardId from the recipient being edited
      const contactCardId = recipient.contactCardId;

      const res = await fetch(`/api/accounts/${accountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: [{
            id: recipient.id,
            isPrimary: data.isPrimary,
            recipientType: data.recipientType,
            firstName: data.firstName || null,
            middleName: data.middleName || null,
            lastName: data.lastName || null,
            personAlias: data.personAlias || null,
            birthdate: data.birthdate,
            businessName: data.businessName || null,
            businessAlias: data.businessAlias || null,
            idType: data.idType,
            idStateCountry: data.idStateCountry,
            idExpirationDate: data.idExpirationDate,
            idVerifiedDate: data.idVerifiedDate,
            idVerifiedBy: data.idVerifiedBy,
            _isNew: recipient._isNew,
          }],
          // Always update phone/email for any recipient with a contactCardId
          ...(contactCardId ? {
            phoneNumbers: data.phoneNumbers.map((p) => ({
              id: p.id,
              contactCardId: p._isNew ? contactCardId : undefined,
              phone: p.phone,
              isMobile: p.isMobile,
              isPrimary: p.isPrimary,
              label: p.label || null,
              _delete: p._delete,
            })),
            emailAddresses: data.emailAddresses.map((e) => ({
              id: e.id,
              contactCardId: e._isNew ? contactCardId : undefined,
              email: e.email,
              isPrimary: e.isPrimary,
              label: e.label || null,
              _delete: e._delete,
            })),
          } : {}),
        }),
      });
      if (!res.ok) {
        const errorData = await res.json() as { error?: string };
        throw new Error(errorData.error ?? 'Failed to save');
      }
      await fetchAccount();
      setEditingRecipientIndex(null);
      setSuccessMessage('Recipient updated successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // Add new recipient - opens dialog immediately, saves on dialog save
  const addRecipient = (type: 'PERSON' | 'BUSINESS'): void => {
    const newRecipient: FormRecipient = {
      isPrimary: false,
      recipientType: type,
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
      _isNew: true,
    };
    const newIndex = recipients.length;
    setRecipients([...recipients, newRecipient]);
    setEditingRecipientIndex(newIndex);
  };

  // Remove recipient
  const removeRecipient = async (index: number): Promise<void> => {
    const recipient = recipients[index];
    if (!recipient || recipient.isPrimary || !recipient.id) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounts/${accountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: [{
            id: recipient.id,
            _delete: true,
          }],
        }),
      });
      if (!res.ok) {
        const errorData = await res.json() as { error?: string };
        throw new Error(errorData.error ?? 'Failed to remove recipient');
      }
      await fetchAccount();
      setSuccessMessage('Recipient removed');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove recipient');
    } finally {
      setSaving(false);
    }
  };

  // Get primary recipient for display
  const primaryRecipient = recipients.find((r) => r.isPrimary && !r._delete);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <p className="text-red-600">{error ?? 'Account not found'}</p>
        <Link href="/accounts" className="mt-4 inline-block text-postnet-red hover:underline">
          Back to Accounts
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="rounded-md p-2 text-gray-600 hover:bg-gray-100"
            aria-label="Back to accounts"
          >
            <BackIcon />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                Mailbox <span className="font-mono">{account.mailbox.number}</span>
              </h1>
              <StatusBadge status={account.status} />
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {primaryRecipient ? <RecipientNameDisplay recipient={primaryRecipient} /> : 'No account holder'}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      {successMessage && (
        <div className="mb-4 rounded-md bg-green-50 border border-green-200 p-4">
          <p className="text-sm text-green-600">{successMessage}</p>
        </div>
      )}

      {/* Audit Flag Alert */}
      {account.auditFlag && (
        <div className="mb-4 rounded-md bg-amber-50 border border-amber-300 p-4">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-800">Audit Flag</h3>
              <p className="text-sm text-amber-700 mt-1">
                {account.auditNote ?? 'This account has been flagged for rate review.'}
              </p>
              {account.auditedAt && (
                <p className="text-xs text-amber-600 mt-2">
                  Flagged on {format(new Date(account.auditedAt), 'MMM d, yyyy \'at\' h:mm a')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Account Info Card */}
        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Account Information</h2>
            <button
              onClick={() => setAccountEditOpen(true)}
              className="flex items-center gap-1 text-sm text-postnet-red hover:text-postnet-red-dark"
              disabled={saving}
            >
              <EditIcon /> Edit
            </button>
          </div>
          <dl className="space-y-4">
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Status</dt>
              <dd className="text-sm font-medium">
                <StatusBadge status={account.status} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Renewal Period</dt>
              <dd className="text-sm font-medium">{formatRenewalPeriod(account.renewalPeriod)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Current Rate</dt>
              <dd className="text-sm font-medium font-mono">${Number(account.currentRate).toFixed(2)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Start Date</dt>
              <dd className="text-sm font-medium">{format(new Date(account.startDate), 'MM/dd/yyyy')}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Next Renewal</dt>
              <dd className="text-sm font-medium">{format(new Date(account.nextRenewalDate), 'MM/dd/yyyy')}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Deposit</dt>
              <dd className="text-sm font-medium font-mono">
                ${Number(account.depositPaid).toFixed(2)}
                {account.depositReturned && (
                  <span className="ml-2 text-xs text-gray-500">(Returned)</span>
                )}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Notifications</dt>
              <dd className="flex gap-2">
                {account.smsEnabled && (
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                    SMS
                  </span>
                )}
                {account.emailEnabled && (
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                    Email
                  </span>
                )}
                {!account.smsEnabled && !account.emailEnabled && (
                  <span className="text-xs text-gray-400">None</span>
                )}
              </dd>
            </div>
          </dl>
        </div>

        {/* Mailbox Info Card */}
        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Mailbox</h2>
            <button
              onClick={() => setMailboxEditOpen(true)}
              className="flex items-center gap-1 text-sm text-postnet-red hover:text-postnet-red-dark"
              disabled={saving}
            >
              <EditIcon /> Reassign
            </button>
          </div>
          <dl className="space-y-4">
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Number</dt>
              <dd className="text-sm font-medium font-mono">{account.mailbox.number}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Status</dt>
              <dd className="text-sm font-medium">{account.mailbox.status}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Key Deposit</dt>
              <dd className="text-sm font-medium font-mono">${Number(account.mailbox.keyDeposit).toFixed(2)}</dd>
            </div>
          </dl>
          <div className="mt-4 pt-4 border-t">
            <Link
              href={`/mailboxes/${account.mailbox.id}`}
              className="text-sm text-postnet-red hover:underline"
            >
              View Mailbox Details
            </Link>
          </div>
        </div>

        {/* Quick Actions - Generate Notices */}
        {noticeTypes.length > 0 && (() => {
          // Calculate which notices are applicable
          const isHold = account.status === 'HOLD';

          // Check if renewal is within 30 days
          const renewalDate = new Date(account.nextRenewalDate);
          const today = new Date();
          const daysUntilRenewal = Math.ceil((renewalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          const isRenewalSoon = account.status === 'ACTIVE' && daysUntilRenewal >= 0 && daysUntilRenewal <= 30;

          // Find adult recipients (18+) without ID verification
          const adultRecipientsWithoutId = recipients
            .filter((r) => !r._delete && r.recipientType === 'PERSON')
            .filter((r) => {
              // Check if adult
              if (!r.birthdate) return true; // No birthdate means treat as adult
              const birth = new Date(r.birthdate);
              const today = new Date();
              let age = today.getFullYear() - birth.getFullYear();
              const monthDiff = today.getMonth() - birth.getMonth();
              if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
                age--;
              }
              return age >= 18;
            })
            .filter((r) => !r.idVerifiedDate);

          // Find recipients with expiring IDs (within 30 days)
          const recipientsWithExpiringId = recipients
            .filter((r) => !r._delete && r.recipientType === 'PERSON')
            .filter((r) => {
              if (!r.idVerifiedDate || !r.idExpirationDate) return false;
              const expDate = new Date(r.idExpirationDate);
              const today = new Date();
              const daysUntil = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              return daysUntil > 0 && daysUntil <= 30;
            });

          const hasApplicableNotices = isHold || isRenewalSoon || adultRecipientsWithoutId.length > 0 || recipientsWithExpiringId.length > 0;

          if (!hasApplicableNotices) return null;

          return (
            <div className="rounded-lg border bg-white p-6 lg:col-span-2">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="flex flex-wrap gap-2">
                {/* Hold Notice - for HOLD status */}
                {isHold && (
                  <button
                    onClick={() => void generateNotice('HOLD_NOTICE')}
                    disabled={generatingNotice !== null}
                    className="inline-flex items-center gap-2 rounded-md bg-amber-100 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-200 disabled:opacity-50"
                  >
                    {generatingNotice === 'HOLD_NOTICE' ? (
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                      </svg>
                    )}
                    Generate Hold Notice
                  </button>
                )}

                {/* Renewal Notice - for accounts with renewal within 30 days */}
                {isRenewalSoon && (
                  <button
                    onClick={() => void generateNotice('RENEWAL_NOTICE')}
                    disabled={generatingNotice !== null}
                    className="inline-flex items-center gap-2 rounded-md bg-blue-100 px-3 py-2 text-sm font-medium text-blue-800 hover:bg-blue-200 disabled:opacity-50"
                  >
                    {generatingNotice === 'RENEWAL_NOTICE' ? (
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                      </svg>
                    )}
                    Generate Renewal Notice
                  </button>
                )}

                {/* Missing ID Notice - for recipients without ID */}
                {adultRecipientsWithoutId.length > 0 && (
                  <button
                    onClick={() => void generateNotice('MISSING_ID', adultRecipientsWithoutId.map((r) => r.id).filter((id): id is string => !!id))}
                    disabled={generatingNotice !== null}
                    className="inline-flex items-center gap-2 rounded-md bg-orange-100 px-3 py-2 text-sm font-medium text-orange-800 hover:bg-orange-200 disabled:opacity-50"
                  >
                    {generatingNotice === 'MISSING_ID' ? (
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z" />
                      </svg>
                    )}
                    Request Missing ID ({adultRecipientsWithoutId.length})
                  </button>
                )}

                {/* ID Verification Request - for expiring IDs */}
                {recipientsWithExpiringId.length > 0 && (
                  <button
                    onClick={() => void generateNotice('ID_VERIFICATION_REQUEST', recipientsWithExpiringId.map((r) => r.id).filter((id): id is string => !!id))}
                    disabled={generatingNotice !== null}
                    className="inline-flex items-center gap-2 rounded-md bg-yellow-100 px-3 py-2 text-sm font-medium text-yellow-800 hover:bg-yellow-200 disabled:opacity-50"
                  >
                    {generatingNotice === 'ID_VERIFICATION_REQUEST' ? (
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                      </svg>
                    )}
                    Request ID Renewal ({recipientsWithExpiringId.length})
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        {/* Account Holder Card - Business Card Style */}
        <div className="rounded-lg border bg-white p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Holder</h2>

          {primaryRecipient ? (
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200 shadow-sm relative">
              {/* Edit Button - top right */}
              <button
                onClick={() => {
                  const primaryIndex = recipients.findIndex((r) => r.isPrimary && !r._delete);
                  if (primaryIndex !== -1) setEditingRecipientIndex(primaryIndex);
                }}
                className="absolute top-3 right-3 flex items-center gap-1 text-sm text-postnet-red hover:text-postnet-red-dark bg-white px-2 py-1 rounded-md border border-gray-200 shadow-sm hover:shadow"
                disabled={saving}
              >
                <EditIcon /> Edit
              </button>

              {/* Name */}
              <h3 className="text-lg font-semibold text-gray-900 pr-20">
                {primaryRecipient ? <RecipientNameDisplay recipient={primaryRecipient} /> : 'Unknown'}
              </h3>
              <div className="flex flex-wrap gap-1.5 mt-1 mb-3">
                <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                  Primary
                </span>
                {primaryRecipient.recipientType === 'BUSINESS' && (
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                    Business
                  </span>
                )}
                {primaryRecipient.recipientType === 'PERSON' && (
                  !primaryRecipient.idVerifiedDate ||
                  (primaryRecipient.idExpirationDate && new Date(primaryRecipient.idExpirationDate) < new Date())
                ) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z" />
                    </svg>
                    ID Required
                  </span>
                )}
              </div>

              {/* Contact Info */}
              <div className="space-y-1.5 text-sm">
                {/* Phone Numbers */}
                {account.phoneNumbers.length > 0 ? (
                  account.phoneNumbers.map((phone) => (
                    <div key={phone.id} className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                      </svg>
                      <span className="font-mono">{formatPhone(phone.phone)}</span>
                      {phone.label && <span className="text-xs text-gray-500">({phone.label})</span>}
                      {phone.isMobile && <span className="text-xs text-gray-500 bg-gray-200 px-1 rounded">Mobile</span>}
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-2 text-gray-400">
                    <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                    </svg>
                    <span>No phone</span>
                  </div>
                )}

                {/* Email Addresses */}
                {account.emailAddresses.length > 0 ? (
                  account.emailAddresses.map((email) => (
                    <div key={email.id} className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                      </svg>
                      <span className="break-all">{email.email}</span>
                      {email.label && <span className="text-xs text-gray-500">({email.label})</span>}
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-2 text-gray-400">
                    <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                    </svg>
                    <span>No email</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">No account holder</p>
          )}
        </div>

        {/* Additional Recipients Card */}
        <div className="rounded-lg border bg-white p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Additional Recipients</h2>
            <button
              type="button"
              onClick={() => addRecipient('PERSON')}
              className="text-xs text-postnet-red hover:underline"
              disabled={saving}
            >
              Add New
            </button>
          </div>
          {recipients.filter((r) => !r._delete && !r.isPrimary).length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              {/* Header Row */}
              <div className="flex items-start gap-2 px-3 py-2 bg-gray-100 border-b text-xs font-medium text-gray-500 uppercase tracking-wide">
                <span className="flex-1 min-w-0">Name</span>
                <span className="w-16 text-center hidden sm:block">ID</span>
                <span className="w-32 text-center hidden sm:block">Phone</span>
                <span className="w-16 sm:w-20 text-center flex-shrink-0">Type</span>
                <span className="w-16 sm:w-20 text-right flex-shrink-0">Actions</span>
              </div>
              {/* Data Rows */}
              <div className="divide-y">
                {recipients
                  .filter((r) => !r._delete && !r.isPrimary)
                  .sort((a, b) => {
                    // Business entries first, then persons
                    if (a.recipientType === 'BUSINESS' && b.recipientType !== 'BUSINESS') return -1;
                    if (a.recipientType !== 'BUSINESS' && b.recipientType === 'BUSINESS') return 1;

                    // Within each type, sort alphabetically by display name
                    const getDisplayName = (r: FormRecipient): string => {
                      if (r.recipientType === 'BUSINESS') {
                        return (r.businessAlias || r.businessName || '').toLowerCase();
                      }
                      return [r.firstName, r.middleName, r.lastName].filter(Boolean).join(' ').toLowerCase();
                    };

                    return getDisplayName(a).localeCompare(getDisplayName(b));
                  })
                  .map((recipient) => {
                  const actualIndex = recipients.findIndex((r) => r.id === recipient.id || (!r.id && !recipient.id && r === recipient));

                  // Check if minor (under 18) and if turning 18 soon (within 30 days)
                  let isMinor = false;
                  let turningAdultSoon = false;
                  let personAge: number | null = null;
                  if (recipient.recipientType === 'PERSON' && recipient.birthdate) {
                    const birth = new Date(recipient.birthdate);
                    const today = new Date();
                    let age = today.getFullYear() - birth.getFullYear();
                    const monthDiff = today.getMonth() - birth.getMonth();
                    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
                      age--;
                    }
                    personAge = age;
                    isMinor = age < 18;

                    // Check if 18th birthday is within 30 days
                    if (isMinor) {
                      const eighteenthBirthday = new Date(birth);
                      eighteenthBirthday.setFullYear(birth.getFullYear() + 18);
                      const daysUntil18 = Math.ceil((eighteenthBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      turningAdultSoon = daysUntil18 > 0 && daysUntil18 <= 30;
                    }
                  }

                  // Determine row background color
                  const rowBgClass = recipient.recipientType === 'BUSINESS'
                    ? 'bg-blue-50'
                    : isMinor
                      ? turningAdultSoon ? 'bg-orange-50' : 'bg-amber-50'
                      : 'bg-white hover:bg-gray-50';

                  // Get primary phone number if available
                  const primaryPhone = recipient.phoneNumbers.find((p) => !p._delete);

                  // ID verification status for PERSON recipients (adults only - minors don't need ID)
                  let idStatus: 'verified' | 'expiring' | 'expired' | 'not-verified' | 'na' = 'na';
                  if (recipient.recipientType === 'PERSON' && !isMinor) {
                    if (recipient.idVerifiedDate) {
                      if (recipient.idExpirationDate) {
                        const expDate = new Date(recipient.idExpirationDate);
                        const today = new Date();
                        const daysUntilExpiry = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        if (daysUntilExpiry < 0) {
                          idStatus = 'expired';
                        } else if (daysUntilExpiry <= 30) {
                          idStatus = 'expiring';
                        } else {
                          idStatus = 'verified';
                        }
                      } else {
                        idStatus = 'verified';
                      }
                    } else {
                      idStatus = 'not-verified';
                    }
                  }

                  // Type badge - show age for minors, "Adult" for adults
                  const typeBadge = recipient.recipientType === 'BUSINESS' ? (
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                      Business
                    </span>
                  ) : isMinor ? (
                    turningAdultSoon ? (
                      <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-800">
                        Age {personAge}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                        Age {personAge}
                      </span>
                    )
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      Adult
                    </span>
                  );

                  // ID status badge - orange ID card icon for not-verified or expired
                  const idBadge = idStatus === 'na' ? (
                    <span className="text-xs text-gray-300">—</span>
                  ) : idStatus === 'verified' ? (
                    <span className="inline-flex items-center text-green-600" title="ID Verified">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </span>
                  ) : idStatus === 'expiring' ? (
                    <span className="inline-flex items-center text-amber-600" title="ID Expiring Soon">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </span>
                  ) : (
                    // expired or not-verified - show orange ID card icon
                    <span className="inline-flex items-center text-orange-500" title={idStatus === 'expired' ? 'ID Expired' : 'ID Required'}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z" />
                      </svg>
                    </span>
                  );

                  return (
                    <div key={recipient.id ?? `new-${actualIndex}`} className={`flex items-start gap-2 px-3 py-2 ${rowBgClass}`}>
                      <span className="text-sm flex-1 min-w-0 break-words"><RecipientNameDisplay recipient={recipient} /></span>
                      <span className="w-16 flex justify-center hidden sm:flex flex-shrink-0">{idBadge}</span>
                      <span className="w-32 text-center hidden sm:block flex-shrink-0">
                        {primaryPhone ? (
                          <span className="text-sm text-gray-500 font-mono">
                            {formatPhone(primaryPhone.phone)}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </span>
                      <span className="w-16 sm:w-20 flex justify-center flex-shrink-0">{typeBadge}</span>
                      <span className="w-16 sm:w-20 flex justify-end gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => setEditingRecipientIndex(actualIndex)}
                          className="px-1 sm:px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                          disabled={saving}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmIndex(actualIndex)}
                          className="px-1 sm:px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                          aria-label="Delete recipient"
                          disabled={saving}
                        >
                          Del
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">No additional recipients</p>
          )}
        </div>
      </div>

      {/* Account Edit Dialog */}
      <AccountEditDialog
        isOpen={accountEditOpen}
        data={account ? {
          status: account.status,
          renewalPeriod: account.renewalPeriod,
          currentRate: account.currentRate,
          nextRenewalDate: account.nextRenewalDate,
          smsEnabled: account.smsEnabled,
          emailEnabled: account.emailEnabled,
        } : null}
        onClose={() => setAccountEditOpen(false)}
        onSave={handleAccountSave}
      />

      {/* Mailbox Reassign Dialog */}
      <MailboxReassignDialog
        isOpen={mailboxEditOpen}
        currentMailbox={account ? {
          id: account.mailbox.id,
          number: account.mailbox.number,
        } : null}
        onClose={() => setMailboxEditOpen(false)}
        onSave={handleMailboxSave}
      />

      {/* Recipient Edit Dialog */}
      <RecipientEditDialog
        isOpen={editingRecipientIndex !== null}
        recipient={editingRecipientIndex !== null ? recipients[editingRecipientIndex] ?? null : null}
        onClose={() => setEditingRecipientIndex(null)}
        onSave={handleRecipientSave}
      />

      {/* Delete Confirmation Dialog */}
      {deleteConfirmIndex !== null && (() => {
        const recipientToDelete = recipients[deleteConfirmIndex];
        const deleteName = recipientToDelete?.recipientType === 'BUSINESS'
          ? recipientToDelete.businessName || 'this business'
          : [recipientToDelete?.firstName, recipientToDelete?.lastName].filter(Boolean).join(' ') || 'this recipient';

        return (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <div
                className="fixed inset-0 bg-black/50 transition-opacity"
                onClick={() => setDeleteConfirmIndex(null)}
                aria-hidden="true"
              />
              <div className="relative w-full max-w-sm rounded-lg bg-white shadow-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Delete Recipient
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Are you sure you want to remove <strong>{deleteName}</strong> from this account? This action cannot be undone.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setDeleteConfirmIndex(null)}
                    className="rounded-md border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      void removeRecipient(deleteConfirmIndex);
                      setDeleteConfirmIndex(null);
                    }}
                    className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default function AccountDetailPage(): React.ReactElement {
  return (
    <AppLayout>
      <AccountDetailContent />
    </AppLayout>
  );
}
