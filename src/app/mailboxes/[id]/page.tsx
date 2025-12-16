'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout';
import { format } from 'date-fns';

interface Recipient {
  id: string;
  name: string;
  recipientType: 'PERSON' | 'BUSINESS';
  isPrimary: boolean;
}

interface AccountHistoryItem {
  id: string;
  status: string;
  holderName: string;
  startDate: string;
  endDate: string | null;
  nextRenewalDate: string;
}

interface MailboxDetail {
  id: string;
  number: number;
  status: string;
  keyDeposit: string;
  createdAt: string;
  updatedAt: string;
  account: {
    id: string;
    status: string;
    holderName: string;
    nextRenewalDate: string;
  } | null;
  recipients: Recipient[];
  accountHistory: AccountHistoryItem[];
}

interface FormData {
  status: string;
  keyDeposit: string;
}

function StatusBadge({ status }: { status: string }): React.ReactElement {
  const colors: Record<string, string> = {
    AVAILABLE: 'bg-green-100 text-green-800',
    ACTIVE: 'bg-blue-100 text-blue-800',
    RESERVED: 'bg-yellow-100 text-yellow-800',
    MAINTENANCE: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${colors[status] ?? 'bg-gray-100'}`}>
      {status}
    </span>
  );
}

function AccountStatusBadge({ status }: { status: string }): React.ReactElement {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    HOLD: 'bg-yellow-100 text-yellow-800',
    CLOSED: 'bg-gray-100 text-gray-800',
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? 'bg-gray-100'}`}>
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

function MailboxDetailContent(): React.ReactElement {
  const params = useParams();
  const router = useRouter();
  const mailboxId = params.id as string;

  const [mailbox, setMailbox] = useState<MailboxDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    status: '',
    keyDeposit: '',
  });

  const fetchMailbox = useCallback(async () => {
    try {
      const res = await fetch(`/api/mailboxes/${mailboxId}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError('Mailbox not found');
          return;
        }
        throw new Error('Failed to fetch mailbox');
      }
      const data = await res.json() as MailboxDetail;
      setMailbox(data);
      setFormData({
        status: data.status,
        keyDeposit: data.keyDeposit,
      });
    } catch {
      setError('Failed to load mailbox details');
    } finally {
      setLoading(false);
    }
  }, [mailboxId]);

  useEffect(() => {
    void fetchMailbox();
  }, [fetchMailbox]);

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/mailboxes/${mailboxId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: formData.status,
          keyDeposit: formData.keyDeposit,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json() as { error?: string };
        throw new Error(errorData.error ?? 'Failed to save');
      }

      await fetchMailbox();
      setIsEditing(false);
      setSuccessMessage('Mailbox updated successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = (): void => {
    if (mailbox) {
      setFormData({
        status: mailbox.status,
        keyDeposit: mailbox.keyDeposit,
      });
    }
    setIsEditing(false);
    setError(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!mailbox) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <p className="text-red-600">{error ?? 'Mailbox not found'}</p>
        <Link href="/mailboxes" className="mt-4 inline-block text-postnet-red hover:underline">
          Back to Mailboxes
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4 flex-1">
          <button
            onClick={() => router.back()}
            className="rounded-md p-2 text-gray-600 hover:bg-gray-100 mt-1"
            aria-label="Back to mailboxes"
          >
            <BackIcon />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                Mailbox <span className="font-mono">{mailbox.number}</span>
              </h1>
              <StatusBadge status={mailbox.status} />
            </div>
            {/* Recipients in two columns */}
            {mailbox.recipients.length > 0 && (
              <div className="flex gap-6 mt-2">
                {/* Persons column */}
                <ul className="space-y-0.5">
                  {mailbox.recipients
                    .filter((r) => r.recipientType === 'PERSON')
                    .map((r) => (
                      <li key={r.id} className="text-sm text-gray-700 flex items-start gap-1">
                        <span className="text-gray-400 leading-5">•</span>
                        <span className="leading-5">
                          {r.name}
                          {r.isPrimary && (
                            <span className="text-xs text-gray-400 ml-1">(Primary)</span>
                          )}
                        </span>
                      </li>
                    ))}
                </ul>
                {/* Businesses column */}
                {mailbox.recipients.filter((r) => r.recipientType === 'BUSINESS').length > 0 && (
                  <ul className="space-y-0.5">
                    {mailbox.recipients
                      .filter((r) => r.recipientType === 'BUSINESS')
                      .map((r) => (
                        <li key={r.id} className="text-sm text-blue-700 flex items-start gap-1">
                          <span className="text-blue-400 leading-5">•</span>
                          <span className="leading-5">
                            {r.name}
                            {r.isPrimary && (
                              <span className="text-xs text-blue-400 ml-1">(Primary)</span>
                            )}
                          </span>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            )}
            {mailbox.recipients.length === 0 && !mailbox.account && (
              <p className="text-sm text-gray-400 mt-1 italic">No recipients</p>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="rounded-md bg-postnet-red px-4 py-2 text-sm text-white hover:bg-postnet-red-dark"
            >
              Edit
            </button>
          ) : (
            <>
              <button
                onClick={handleCancel}
                className="rounded-md border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="rounded-md bg-postnet-red px-4 py-2 text-sm text-white hover:bg-postnet-red-dark disabled:opacity-50"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          )}
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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Mailbox Info Card */}
        <div className="rounded-lg border bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Mailbox Information</h2>
          <dl className="space-y-4">
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Number</dt>
              <dd className="text-sm font-medium font-mono">{mailbox.number}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Status</dt>
              <dd className="text-sm font-medium">
                {isEditing ? (
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="rounded-md border px-2 py-1 text-sm"
                    disabled={mailbox.account !== null && formData.status !== 'MAINTENANCE'}
                  >
                    <option value="AVAILABLE" disabled={mailbox.account !== null}>Available</option>
                    <option value="ACTIVE">Active</option>
                    <option value="RESERVED">Reserved</option>
                    <option value="MAINTENANCE">Maintenance</option>
                  </select>
                ) : (
                  <StatusBadge status={mailbox.status} />
                )}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Key Deposit</dt>
              <dd className="text-sm font-medium font-mono">
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <span>$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.keyDeposit}
                      onChange={(e) => setFormData({ ...formData, keyDeposit: e.target.value })}
                      className="w-20 rounded-md border px-2 py-1 text-sm text-right"
                    />
                  </div>
                ) : (
                  `$${Number(mailbox.keyDeposit).toFixed(2)}`
                )}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Created</dt>
              <dd className="text-sm font-medium">
                {format(new Date(mailbox.createdAt), 'MM/dd/yyyy')}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Last Updated</dt>
              <dd className="text-sm font-medium">
                {format(new Date(mailbox.updatedAt), 'MM/dd/yyyy HH:mm')}
              </dd>
            </div>
          </dl>
        </div>

        {/* Account Info Card */}
        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Account</h2>
            {mailbox.account && (
              <Link
                href={`/accounts/${mailbox.account.id}`}
                className="text-sm text-postnet-red hover:underline"
              >
                View Details
              </Link>
            )}
          </div>
          {mailbox.account ? (
            <dl className="space-y-4">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Account Holder</dt>
                <dd className="text-sm font-medium">{mailbox.account.holderName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Account Status</dt>
                <dd className="text-sm font-medium">
                  <AccountStatusBadge status={mailbox.account.status} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Next Renewal</dt>
                <dd className="text-sm font-medium">
                  {format(new Date(mailbox.account.nextRenewalDate), 'MM/dd/yyyy')}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-gray-500">No account assigned to this mailbox.</p>
          )}
        </div>
      </div>

      {/* Account History */}
      {mailbox.accountHistory.length > 0 && (
        <div className="mt-6 rounded-lg border bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Account History</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Account Holder</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Start Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">End Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {mailbox.accountHistory.map((account) => (
                  <tr
                    key={account.id}
                    className={`hover:bg-gray-50 cursor-pointer ${account.status === 'CLOSED' ? 'text-gray-400' : ''}`}
                  >
                    <td className="px-4 py-3 text-sm">
                      <Link
                        href={`/accounts/${account.id}`}
                        className="text-postnet-red hover:underline"
                      >
                        {account.holderName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <AccountStatusBadge status={account.status} />
                    </td>
                    <td className="px-4 py-3 text-sm font-mono">
                      {format(new Date(account.startDate), 'MM/dd/yyyy')}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono">
                      {account.endDate
                        ? format(new Date(account.endDate), 'MM/dd/yyyy')
                        : <span className="text-gray-400">—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MailboxDetailPage(): React.ReactElement {
  return (
    <AppLayout>
      <MailboxDetailContent />
    </AppLayout>
  );
}
