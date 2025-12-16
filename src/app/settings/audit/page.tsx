'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppLayout } from '@/components/layout';

type AuditFlagType = 'UNDERCHARGED' | 'OVERCHARGED' | 'RECIPIENT_OVERFLOW';

interface BusinessRecipient {
  name: string;
  alias: string | null;
}

interface PersonRecipient {
  name: string;
  age: number | null;
  isMinor: boolean;
}

interface AuditResult {
  accountId: string;
  mailboxId: string;
  mailboxNumber: number;
  accountName: string;
  personRecipients: PersonRecipient[];
  businessRecipients: BusinessRecipient[];
  currentRate: number;
  expectedRate: number;
  discrepancy: number;
  hasOverride: boolean;
  auditFlag: boolean;
  auditFlagType: AuditFlagType | null;
  auditNote: string | null;
  recipientCount: number;
}

interface AuditSummary {
  totalAccounts: number;
  accountsAudited: number;
  accountsFlagged: number;
  accountsWithOverride: number;
  accountsOk: number;
}

type ViewType = 'flagged' | 'override';

function BusinessNameDisplay({ name, alias }: { name: string; alias: string | null }): React.ReactElement {
  if (alias) {
    return (
      <>
        {name} <span className="text-gray-500">(DBA:</span> <span className="font-bold">{alias}</span><span className="text-gray-500">)</span>
      </>
    );
  }
  return <>{name}</>;
}

function AuditContent(): React.ReactElement {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isManager = session?.user?.role === 'MANAGER';

  // Initialize pagination from URL params
  const initialPage = parseInt(searchParams.get('page') ?? '1', 10) || 1;
  const initialPageSize = parseInt(searchParams.get('limit') ?? '20', 10) || 20;
  const initialView = (searchParams.get('view') as ViewType) ?? 'flagged';

  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [accounts, setAccounts] = useState<AuditResult[]>([]);
  const [currentView, setCurrentView] = useState<ViewType>(initialView);
  const [error, setError] = useState<string | null>(null);
  const [overrideModalAccount, setOverrideModalAccount] = useState<AuditResult | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50] as const;

  // Sync pagination state to URL
  useEffect(() => {
    const url = new URL(window.location.href);

    if (currentPage > 1) {
      url.searchParams.set('page', currentPage.toString());
    } else {
      url.searchParams.delete('page');
    }

    if (pageSize !== 20) {
      url.searchParams.set('limit', pageSize.toString());
    } else {
      url.searchParams.delete('limit');
    }

    if (currentView !== 'flagged') {
      url.searchParams.set('view', currentView);
    } else {
      url.searchParams.delete('view');
    }

    router.replace(url.pathname + url.search);
  }, [currentPage, pageSize, currentView, router]);

  const runAudit = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to run audit');
      }

      const data = await res.json();
      setSummary(data.summary);
      setAccounts(data.flaggedAccounts);
      setCurrentView('flagged');
      setCurrentPage(1); // Reset to first page
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = useCallback(async (view: ViewType, resetPage = false): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/audit?view=${view}`);
      if (!res.ok) {
        throw new Error('Failed to fetch accounts');
      }
      const data = await res.json();
      setAccounts(data.data);
      setSummary(data.summary);
      setCurrentView(view);
      if (resetPage) {
        setCurrentPage(1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Pagination calculations
  const totalItems = accounts.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedAccounts = accounts.slice(startIndex, endIndex);

  const handlePageSizeChange = (newSize: number): void => {
    setPageSize(newSize);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  // Auto-fetch accounts on mount
  useEffect(() => {
    void fetchAccounts(initialView);
  }, [fetchAccounts, initialView]);

  const clearAuditData = async (): Promise<void> => {
    if (!confirm('Are you sure you want to clear all audit data? This will remove all audit flags and notes.')) {
      return;
    }

    setClearing(true);
    setError(null);
    try {
      const res = await fetch('/api/audit', {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to clear audit data');
      }

      // Refresh data to get updated summary
      await fetchAccounts('flagged', true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setClearing(false);
    }
  };

  const handleSetOverride = async (): Promise<void> => {
    if (!overrideModalAccount || !overrideReason.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/accounts/${overrideModalAccount.accountId}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: overrideReason }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to set override');
      }

      setOverrideModalAccount(null);
      setOverrideReason('');

      // Refresh data to get updated summary and account list
      await fetchAccounts(currentView, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-postnet-charcoal">Audit</h1>
          <p className="mt-1 text-sm text-postnet-gray">
            Audit account rates and recipient counts
          </p>
        </div>
        <div className="flex gap-2">
          {isManager && (
            <>
              <button
                onClick={clearAuditData}
                disabled={loading || clearing}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {clearing ? 'Clearing...' : 'Clear Audit Data'}
              </button>
              <button
                onClick={runAudit}
                disabled={loading || clearing}
                className="rounded-md bg-postnet-red px-4 py-2 text-sm text-white hover:bg-postnet-red-dark disabled:opacity-50"
              >
                {loading ? 'Running...' : 'Run Audit'}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {summary && (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
            <div className="text-2xl font-bold text-postnet-charcoal">{summary.totalAccounts}</div>
            <div className="text-xs text-postnet-gray">Total Accounts</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
            <div className="text-2xl font-bold text-status-active">{summary.accountsOk}</div>
            <div className="text-xs text-postnet-gray">OK</div>
          </div>
          <button
            onClick={() => void fetchAccounts('flagged', true)}
            className={`rounded-lg border p-4 text-center transition-colors ${
              currentView === 'flagged' ? 'bg-status-overdue/10 border-status-overdue' : 'bg-white hover:bg-postnet-gray-light border-gray-200'
            }`}
          >
            <div className="text-2xl font-bold text-status-overdue">{summary.accountsFlagged}</div>
            <div className="text-xs text-postnet-gray">Flagged</div>
          </button>
          <button
            onClick={() => void fetchAccounts('override', true)}
            disabled={summary.accountsWithOverride === 0}
            className={`rounded-lg border p-4 text-center transition-colors ${
              currentView === 'override' ? 'bg-status-hold/10 border-status-hold' : 'bg-white hover:bg-postnet-gray-light border-gray-200'
            } ${summary.accountsWithOverride === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="text-2xl font-bold text-status-hold">{summary.accountsWithOverride}</div>
            <div className="text-xs text-postnet-gray">With Override</div>
          </button>
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
            <div className="text-2xl font-bold text-postnet-gray">{summary.accountsAudited}</div>
            <div className="text-xs text-postnet-gray">Audited</div>
          </div>
        </div>
      )}

      {accounts.length > 0 ? (
        <div className="rounded-lg border bg-white shadow">
          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-gray-200">
            {paginatedAccounts.map((account) => {
              const getBgClass = (): string => {
                if (account.auditFlagType === 'OVERCHARGED') return 'bg-yellow-50';
                if (account.auditFlagType === 'RECIPIENT_OVERFLOW') return 'bg-red-50';
                return '';
              };

              const getFlagTypeBadge = (): React.ReactElement | null => {
                if (!account.auditFlagType) return null;
                switch (account.auditFlagType) {
                  case 'UNDERCHARGED':
                    return (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        Undercharged
                      </span>
                    );
                  case 'OVERCHARGED':
                    return (
                      <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                        Overcharged
                      </span>
                    );
                  case 'RECIPIENT_OVERFLOW':
                    return (
                      <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                        {account.recipientCount} Recipients
                      </span>
                    );
                  default:
                    return null;
                }
              };

              return (
                <div key={account.accountId} className={`p-4 ${getBgClass()}`}>
                  <div className="flex items-center justify-between mb-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/mailboxes/${account.mailboxId}`);
                      }}
                      className="text-lg font-mono font-bold text-postnet-red hover:underline"
                    >
                      #{account.mailboxNumber}
                    </button>
                    <div className="flex items-center gap-2">
                      {getFlagTypeBadge()}
                      {isManager && currentView === 'flagged' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOverrideModalAccount(account);
                            setOverrideReason('');
                          }}
                          className="text-sm text-postnet-red hover:underline"
                        >
                          Approve
                        </button>
                      )}
                    </div>
                  </div>
                  <div
                    onClick={() => router.push(`/accounts/${account.accountId}`)}
                    className="text-xs cursor-pointer"
                  >
                    <div className="text-xs font-medium text-gray-500 uppercase mb-1">Recipients</div>
                    {(account.personRecipients.length > 0 || account.businessRecipients.length > 0) ? (
                      <div className="text-gray-700 space-y-0.5">
                        {[...account.businessRecipients]
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((business, i) => (
                            <div key={`b-${i}`} className="text-blue-700">
                              <BusinessNameDisplay name={business.name} alias={business.alias} />
                            </div>
                          ))}
                        {[...account.personRecipients]
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((person, i) => (
                            <div key={`p-${i}`} className={person.isMinor ? 'text-purple-700' : ''}>
                              {person.name}
                              {person.isMinor && person.age !== null && (
                                <span className="ml-1 text-xs text-purple-500">
                                  ({person.age})
                                </span>
                              )}
                            </div>
                          ))}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                  {account.auditNote && (
                    <div
                      onClick={() => router.push(`/accounts/${account.accountId}`)}
                      className="mt-3 text-xs text-gray-500 cursor-pointer"
                    >
                      {account.auditNote}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <table className="hidden md:table min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">
                  Mailbox
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Recipients
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">
                  Type
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">
                  Note
                </th>
                {isManager && currentView === 'flagged' && (
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedAccounts.map((account) => {
                // Determine row styling based on flag type
                const getRowStyle = (): React.CSSProperties | undefined => {
                  if (account.auditFlagType === 'OVERCHARGED') {
                    return { backgroundColor: '#FFFFE8' }; // Yellow for overcharging
                  }
                  if (account.auditFlagType === 'RECIPIENT_OVERFLOW') {
                    return { backgroundColor: '#FEE2E2' }; // Light red for overflow
                  }
                  return undefined;
                };

                // Badge styling for flag type
                const getFlagTypeBadge = (): React.ReactElement | null => {
                  if (!account.auditFlagType) return null;
                  switch (account.auditFlagType) {
                    case 'UNDERCHARGED':
                      return (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          Undercharged
                        </span>
                      );
                    case 'OVERCHARGED':
                      return (
                        <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                          Overcharged
                        </span>
                      );
                    case 'RECIPIENT_OVERFLOW':
                      return (
                        <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                          {account.recipientCount} Recipients
                        </span>
                      );
                    default:
                      return null;
                  }
                };

                return (
                  <tr
                    key={account.accountId}
                    onClick={() => router.push(`/accounts/${account.accountId}`)}
                    className="hover:bg-gray-50 cursor-pointer"
                    style={getRowStyle()}
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-center text-sm font-mono font-medium">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/mailboxes/${account.mailboxId}`);
                        }}
                        className="text-postnet-red hover:underline"
                      >
                        {account.mailboxNumber}
                      </button>
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-gray-700">
                      {(account.personRecipients.length > 0 || account.businessRecipients.length > 0) ? (
                        <div className="space-y-0.5">
                          {[...account.businessRecipients]
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((business, i) => (
                              <div key={`b-${i}`} className="text-blue-700">
                                <BusinessNameDisplay name={business.name} alias={business.alias} />
                              </div>
                            ))}
                          {[...account.personRecipients]
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((person, i) => (
                              <div key={`p-${i}`} className={person.isMinor ? 'text-purple-700' : ''}>
                                {person.name}
                                {person.isMinor && person.age !== null && (
                                  <span className="ml-1 text-purple-500">
                                    ({person.age})
                                  </span>
                                )}
                              </div>
                            ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-sm">
                      {getFlagTypeBadge()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                      {account.auditNote ?? '-'}
                    </td>
                    {isManager && currentView === 'flagged' && (
                      <td className="whitespace-nowrap px-4 py-3 text-center text-sm">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOverrideModalAccount(account);
                            setOverrideReason('');
                          }}
                          className="text-postnet-red hover:underline"
                        >
                          Approve
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination Controls */}
          <div className="flex flex-col gap-3 border-t bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700">Show</span>
                <select
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="rounded-md border px-2 py-1 text-sm"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
                <span className="text-sm text-gray-700">per page</span>
              </div>
              <span className="text-sm text-gray-700 sm:hidden">
                {startIndex + 1}-{endIndex} of {totalItems}
              </span>
            </div>

            <div className="flex items-center justify-center gap-4 sm:justify-end">
              <span className="hidden text-sm text-gray-700 sm:inline">
                {startIndex + 1}-{endIndex} of {totalItems}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="rounded-md border px-2 py-1 text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="First page"
                >
                  ««
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="rounded-md border px-2 py-1 text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Previous page"
                >
                  «
                </button>
                <span className="px-3 py-1 text-sm">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-md border px-2 py-1 text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Next page"
                >
                  »
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="rounded-md border px-2 py-1 text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Last page"
                >
                  »»
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : !loading && (
        <div className="rounded-lg border bg-white p-8 text-center text-gray-500">
          {summary
            ? currentView === 'override'
              ? 'No accounts with overrides found.'
              : 'No flagged accounts found.'
            : 'Click "Run Audit" to check account rates.'}
        </div>
      )}

      {loading && (
        <div className="rounded-lg border bg-white p-8 text-center text-gray-500">
          Loading...
        </div>
      )}

      {/* Override Modal */}
      {overrideModalAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setOverrideModalAccount(null)}
          />
          <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Approve Rate Override
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Mailbox <span className="font-mono font-medium">{overrideModalAccount.mailboxNumber}</span> - {overrideModalAccount.accountName}
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Current rate: <span className="font-mono">${overrideModalAccount.currentRate.toFixed(2)}</span><br />
              Expected rate: <span className="font-mono">${overrideModalAccount.expectedRate.toFixed(2)}</span>
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason for Override
              </label>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Enter reason for approving this rate..."
                className="w-full rounded-md border px-3 py-2 text-sm"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setOverrideModalAccount(null)}
                className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSetOverride}
                disabled={!overrideReason.trim() || submitting}
                className="rounded-md bg-postnet-red px-4 py-2 text-sm text-white hover:bg-postnet-red-dark disabled:opacity-50"
              >
                {submitting ? 'Saving...' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AuditFallback(): React.ReactElement {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="h-8 w-32 animate-pulse rounded bg-gray-200" />
          <div className="mt-1 h-4 w-64 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-28 animate-pulse rounded bg-gray-200" />
          <div className="h-10 w-28 animate-pulse rounded bg-gray-200" />
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border bg-white shadow">
        <div className="h-64 animate-pulse bg-gray-100" />
      </div>
    </div>
  );
}

export default function AuditPage(): React.ReactElement {
  return (
    <AppLayout>
      <Suspense fallback={<AuditFallback />}>
        <AuditContent />
      </Suspense>
    </AppLayout>
  );
}
