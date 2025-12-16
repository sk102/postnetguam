'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppLayout } from '@/components/layout';
import { useSelectedMailboxes } from '@/lib/hooks/useSelectedMailboxes';

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50] as const;

interface BusinessRecipient {
  name: string;
  alias: string | null;
}

interface AccountHolder {
  name: string;
  type: 'PERSON' | 'BUSINESS';
}

interface Mailbox {
  id: string;
  number: number;
  status: string;
  accountName: string | null; // Used for sorting
  accountHolder: AccountHolder | null;
  personRecipients: string[]; // Non-primary persons
  businessRecipients: BusinessRecipient[]; // Non-primary businesses
  recipientCount: number;
  auditFlag: boolean;
  accountStatus: string | null;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type SortField = 'number' | 'status' | 'accountName';
type SortOrder = 'asc' | 'desc';

function StatusBadge({ status }: { status: string }): React.ReactElement {
  const colors = {
    AVAILABLE: 'bg-status-available/10 text-status-available',
    ACTIVE: 'bg-status-active/10 text-status-active',
    RESERVED: 'bg-status-hold/10 text-status-hold',
    MAINTENANCE: 'bg-status-overdue/10 text-status-overdue',
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[status as keyof typeof colors] ?? 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}

function SortIcon({ field, sortField, sortOrder }: { field: SortField; sortField: SortField; sortOrder: SortOrder }): React.ReactElement {
  if (field !== sortField) {
    return <span className="ml-1 text-gray-300">↕</span>;
  }
  return <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
}

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

function MailboxesTable(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSelected, toggle, clearAll, count: selectedCount, isLoaded } = useSelectedMailboxes();

  // Initialize state from URL params
  const initialPage = parseInt(searchParams.get('page') ?? '1', 10) || 1;
  const initialPageSize = parseInt(searchParams.get('limit') ?? '25', 10) || 25;
  const initialStatus = searchParams.get('status') ?? '';
  const initialSearch = searchParams.get('search') ?? '';
  const initialSortField = (searchParams.get('sortField') as SortField) ?? 'number';
  const initialSortOrder = (searchParams.get('sortOrder') as SortOrder) ?? 'asc';

  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [sortField, setSortField] = useState<SortField>(initialSortField);
  const [sortOrder, setSortOrder] = useState<SortOrder>(initialSortOrder);

  const handlePageSizeChange = (newSize: number): void => {
    setPageSize(newSize);
    setPage(1);
  };

  // Sync state to URL whenever filter/pagination changes
  useEffect(() => {
    const url = new URL(window.location.href);

    if (page > 1) {
      url.searchParams.set('page', page.toString());
    } else {
      url.searchParams.delete('page');
    }

    if (pageSize !== 25) {
      url.searchParams.set('limit', pageSize.toString());
    } else {
      url.searchParams.delete('limit');
    }

    if (statusFilter) {
      url.searchParams.set('status', statusFilter);
    } else {
      url.searchParams.delete('status');
    }

    if (search) {
      url.searchParams.set('search', search);
    } else {
      url.searchParams.delete('search');
    }

    if (sortField !== 'number') {
      url.searchParams.set('sortField', sortField);
    } else {
      url.searchParams.delete('sortField');
    }

    if (sortOrder !== 'asc') {
      url.searchParams.set('sortOrder', sortOrder);
    } else {
      url.searchParams.delete('sortOrder');
    }

    router.replace(url.pathname + url.search);
  }, [page, pageSize, statusFilter, search, sortField, sortOrder, router]);

  useEffect(() => {
    const fetchMailboxes = async (): Promise<void> => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: pageSize.toString(),
          sortField,
          sortOrder,
          ...(statusFilter && { status: statusFilter }),
          ...(search && { search }),
        });
        const res = await fetch(`/api/mailboxes?${params.toString()}`);
        if (!res.ok) {
          console.error('API error:', res.status);
          setMailboxes([]);
          return;
        }
        const json = await res.json() as { data: Mailbox[]; pagination: PaginationInfo };
        setMailboxes(json.data);
        setPagination(json.pagination);
      } catch (err) {
        console.error('Fetch error:', err);
        setMailboxes([]);
      } finally {
        setLoading(false);
      }
    };
    void fetchMailboxes();
  }, [page, pageSize, statusFilter, search, sortField, sortOrder]);

  const handleSort = (field: SortField): void => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setSearch(formData.get('search') as string);
    setPage(1);
  };

  const handleCheckboxClick = (
    e: React.MouseEvent,
    mailbox: Mailbox
  ): void => {
    e.stopPropagation(); // Prevent row click navigation
    toggle({ id: mailbox.id, number: mailbox.number });
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-postnet-charcoal">Mailboxes</h1>
        <div className="flex flex-col gap-2 sm:flex-row">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              name="search"
              placeholder="Search..."
              defaultValue={search}
              className="flex-1 sm:w-64 rounded-md border px-3 py-1.5 text-sm"
            />
            <button
              type="submit"
              className="rounded-md bg-postnet-red px-3 py-1.5 text-sm text-white hover:bg-postnet-red-dark whitespace-nowrap"
            >
              Search
            </button>
          </form>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-md border px-3 py-1.5 text-sm"
          >
            <option value="">All Status</option>
            <option value="AVAILABLE">Available</option>
            <option value="ACTIVE">Active</option>
            <option value="RESERVED">Reserved</option>
            <option value="MAINTENANCE">Maintenance</option>
          </select>
        </div>
      </div>

      {isLoaded && selectedCount > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <span className="text-sm text-blue-800">
            {selectedCount} mailbox{selectedCount !== 1 ? 'es' : ''} selected
          </span>
          <Link
            href="/mailboxes/print-labels"
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Print Label{selectedCount !== 1 ? 's' : ''}
          </Link>
          <button
            onClick={clearAll}
            className="rounded-md border border-blue-300 bg-white px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-100"
          >
            Clear Selection
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-postnet-gray-light align-bottom">
            <tr>
              <th className="w-14 px-3 py-3 text-center">
                <span className="sr-only">Select</span>
              </th>
              <th
                onClick={() => handleSort('number')}
                className="cursor-pointer px-4 py-3 text-center text-xs font-medium uppercase text-postnet-gray hover:bg-gray-200 transition-colors"
              >
                Number
                <SortIcon field="number" sortField={sortField} sortOrder={sortOrder} />
              </th>
              <th
                onClick={() => handleSort('status')}
                className="cursor-pointer px-4 py-3 text-center text-xs font-medium uppercase text-postnet-gray hover:bg-gray-200 transition-colors"
              >
                Status
                <SortIcon field="status" sortField={sortField} sortOrder={sortOrder} />
              </th>
              <th
                onClick={() => handleSort('accountName')}
                className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase text-postnet-gray hover:bg-gray-200 transition-colors"
              >
                Account Holder
                <SortIcon field="accountName" sortField={sortField} sortOrder={sortOrder} />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-postnet-gray">
                Persons
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-postnet-gray">
                Businesses
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : mailboxes.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No mailboxes found
                </td>
              </tr>
            ) : (
              mailboxes.map((mailbox) => {
                const hasAccount = mailbox.recipientCount > 0;
                return (
                  <tr
                    key={mailbox.id}
                    onClick={() => router.push(`/mailboxes/${mailbox.id}`)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td
                      className={`px-3 py-3 align-top text-center ${hasAccount ? 'cursor-pointer hover:bg-blue-50' : ''}`}
                      onClick={hasAccount ? (e) => handleCheckboxClick(e, mailbox) : undefined}
                    >
                      {hasAccount && (
                        <input
                          type="checkbox"
                          checked={isLoaded && isSelected(mailbox.id)}
                          onChange={() => {}} // Controlled by cell onClick
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 pointer-events-none"
                        />
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-top text-right text-sm font-medium text-postnet-charcoal font-mono">
                      <span className="inline-flex items-center gap-1">
                        {mailbox.auditFlag && (
                          <span
                            className={mailbox.accountStatus === 'HOLD' ? 'text-red-500' : 'text-amber-500'}
                            title="Audit flag"
                          >
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
                            </svg>
                          </span>
                        )}
                        {mailbox.number}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-top text-sm">
                      <StatusBadge status={mailbox.status} />
                    </td>
                    {/* Account Holder */}
                    <td className="px-4 py-3 align-top text-sm">
                      {mailbox.accountHolder ? (
                        <span className={mailbox.accountHolder.type === 'BUSINESS' ? 'text-blue-700 font-medium' : 'text-gray-900'}>
                          {mailbox.accountHolder.name}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    {/* Persons (non-primary) */}
                    <td className="px-4 py-3 align-top text-xs text-gray-700">
                      {mailbox.personRecipients.length > 0 ? (
                        <div className="space-y-0.5">
                          {[...mailbox.personRecipients]
                            .sort((a, b) => a.localeCompare(b))
                            .map((name, i) => (
                              <div key={`p-${i}`}>{name}</div>
                            ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    {/* Businesses (non-primary) */}
                    <td className="px-4 py-3 align-top text-xs text-blue-700">
                      {mailbox.businessRecipients.length > 0 ? (
                        <div className="space-y-0.5">
                          {[...mailbox.businessRecipients]
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((business, i) => (
                              <div key={`b-${i}`}>
                                <BusinessNameDisplay name={business.name} alias={business.alias} />
                              </div>
                            ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.total > 0 && (
        <div className="mt-4 flex items-center justify-between">
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

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-700">
              {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="rounded-md border px-2 py-1 text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="First page"
              >
                ««
              </button>
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="rounded-md border px-2 py-1 text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Previous page"
              >
                «
              </button>
              <span className="px-3 py-1 text-sm">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= pagination.totalPages}
                className="rounded-md border px-2 py-1 text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Next page"
              >
                »
              </button>
              <button
                onClick={() => setPage(pagination.totalPages)}
                disabled={page >= pagination.totalPages}
                className="rounded-md border px-2 py-1 text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Last page"
              >
                »»
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MailboxesFallback(): React.ReactElement {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="h-8 w-32 animate-pulse rounded bg-gray-200" />
        <div className="h-8 w-64 animate-pulse rounded bg-gray-200" />
      </div>
      <div className="overflow-hidden rounded-lg border bg-white shadow">
        <div className="h-64 animate-pulse bg-gray-100" />
      </div>
    </div>
  );
}

export default function MailboxesPage(): React.ReactElement {
  return (
    <AppLayout>
      <Suspense fallback={<MailboxesFallback />}>
        <MailboxesTable />
      </Suspense>
    </AppLayout>
  );
}
