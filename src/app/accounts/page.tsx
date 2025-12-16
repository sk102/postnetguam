'use client';

import { Suspense, useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout';
import { format } from 'date-fns';

const SEARCH_DEBOUNCE_MS = 2000;
const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50] as const;

interface Account {
  id: string;
  mailboxNumber: number;
  name: string;
  status: string;
  renewalPeriod: string;
  nextRenewalDate: string;
  currentRate: number;
  recipientType: 'PERSON' | 'BUSINESS';
  recipientCount: number;
  auditFlag: boolean;
  needsIdUpdate: boolean;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type SortField = 'mailboxNumber' | 'name' | 'status' | 'nextRenewalDate';
type SortOrder = 'asc' | 'desc';

function formatRenewalPeriod(period: string): string {
  switch (period) {
    case 'THREE_MONTH': return '3 mo';
    case 'SIX_MONTH': return '6 mo';
    case 'TWELVE_MONTH': return '12 mo';
    default: return period;
  }
}

function StatusBadge({ status }: { status: string }): React.ReactElement {
  const colors = {
    ACTIVE: 'bg-status-active/10 text-status-active',
    RENEWAL: 'bg-status-renewal/10 text-status-renewal',
    HOLD: 'bg-status-hold/10 text-status-hold',
    CLOSED: 'bg-status-closed/10 text-status-closed',
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

function parseSearchInput(input: string): { search: string; status: string | null } {
  const statusMatch = input.match(/status:(\w+)/i);
  if (statusMatch && statusMatch[1]) {
    const status = statusMatch[1].toUpperCase();
    const search = input.replace(/status:\w+/i, '').trim();
    if (['ACTIVE', 'RENEWAL', 'HOLD', 'CLOSED'].includes(status)) {
      return { search, status };
    }
  }
  return { search: input, status: null };
}

function AccountsTableContent(): React.ReactElement {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Initialize state from URL params
  const initialPage = parseInt(searchParams.get('page') ?? '1', 10) || 1;
  const initialPageSize = parseInt(searchParams.get('limit') ?? '20', 10) || 20;
  const initialStatusParam = searchParams.get('status') ?? '';
  const initialSearchParam = searchParams.get('search') ?? '';
  const initialSortField = (searchParams.get('sortField') as SortField) ?? 'mailboxNumber';
  const initialSortOrder = (searchParams.get('sortOrder') as SortOrder) ?? 'asc';

  // Parse initial search for status filter (e.g., "status:renewal" in search param)
  const parsedInitial = parseSearchInput(initialSearchParam);
  const initialSearch = parsedInitial.status ? parsedInitial.search : initialSearchParam;
  const initialStatus = initialStatusParam || parsedInitial.status || '';

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(initialSearchParam); // What user types (preserve original)
  const [search, setSearch] = useState(initialSearch); // Debounced value sent to API (parsed)
  const [isSearchPending, setIsSearchPending] = useState(false); // Track if debounce is active
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [sortField, setSortField] = useState<SortField>(initialSortField);
  const [sortOrder, setSortOrder] = useState<SortOrder>(initialSortOrder);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handlePageSizeChange = (newSize: number): void => {
    setPageSize(newSize);
    setPage(1);
  };

  // Sync state to URL whenever filter/pagination changes
  useEffect(() => {
    const url = new URL(window.location.href);

    // Update URL params
    if (page > 1) {
      url.searchParams.set('page', page.toString());
    } else {
      url.searchParams.delete('page');
    }

    if (pageSize !== 20) {
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

    if (sortField !== 'mailboxNumber') {
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

  // Debounced search effect
  const handleSearchInputChange = useCallback((value: string): void => {
    setSearchInput(value);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Parse for status filter
    const { search: parsedSearch, status: parsedStatus } = parseSearchInput(value);

    // Check if this would actually change the search
    const wouldChangeSearch = parsedStatus
      ? (parsedSearch !== search || parsedStatus !== statusFilter)
      : (value !== search);

    if (!wouldChangeSearch) {
      setIsSearchPending(false);
      return;
    }

    // Mark search as pending
    setIsSearchPending(true);

    // Set new debounce timer
    debounceTimerRef.current = setTimeout(() => {
      if (parsedStatus) {
        setStatusFilter(parsedStatus);
        setSearch(parsedSearch);
      } else {
        setSearch(value);
      }
      setPage(1);
      setIsSearchPending(false);
    }, SEARCH_DEBOUNCE_MS);
  }, [search, statusFilter]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const fetchAccounts = async (): Promise<void> => {
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
        const res = await fetch(`/api/accounts?${params.toString()}`);
        if (!res.ok) {
          console.error('API error:', res.status);
          setAccounts([]);
          return;
        }
        const json = await res.json() as { data: Account[]; pagination: PaginationInfo };
        setAccounts(json.data);
        setPagination(json.pagination);
      } catch (err) {
        console.error('Fetch error:', err);
        setAccounts([]);
      } finally {
        setLoading(false);
      }
    };
    void fetchAccounts();
  }, [page, pageSize, search, statusFilter, sortField, sortOrder]);

  const handleSort = (field: SortField): void => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const clearStatusFilter = (): void => {
    setStatusFilter('');
    setSearchInput('');
    setSearch('');
    setPage(1);
  };

  return (
    <div>
      {/* Header: Title | Search | Add Button */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Title */}
        <h1 className="text-xl sm:text-2xl font-bold text-postnet-charcoal shrink-0">Accounts</h1>

        {/* Search - grows to fill space */}
        <div className="relative flex-1 max-w-xl">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => handleSearchInputChange(e.target.value)}
            placeholder="Search recipients, memos..."
            className="w-full rounded-lg border border-gray-300 bg-gray-50 py-2 pl-10 pr-10 text-sm placeholder-gray-400 transition-all focus:border-postnet-red focus:bg-white focus:outline-none focus:ring-2 focus:ring-postnet-red/20"
          />
          {/* Clear button or loading spinner */}
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            {isSearchPending ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-postnet-red" />
            ) : searchInput ? (
              <button
                onClick={() => {
                  setSearchInput('');
                  setSearch('');
                  setStatusFilter('');
                  setPage(1);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Clear search"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            ) : null}
          </div>
          {/* Search hint */}
          <div className="absolute -bottom-5 left-0 text-xs text-gray-400 hidden sm:block">
            Tip: Use <span className="font-mono bg-gray-100 px-1 rounded">status:hold</span> to filter by status
          </div>
        </div>

        {/* Add Button - always on the right */}
        <button
          onClick={() => router.push('/accounts/new')}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-postnet-red px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-postnet-red-dark transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Account
        </button>
      </div>

      {statusFilter && (
        <div className="mb-4 mt-2 flex items-center gap-2">
          <span className="text-sm text-gray-500">Filtering by:</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-postnet-red px-3 py-1 text-sm text-white">
            Status: {statusFilter}
            <button
              onClick={clearStatusFilter}
              className="ml-1 hover:text-gray-200"
              aria-label="Clear status filter"
            >
              ×
            </button>
          </span>
        </div>
      )}

      {/* Mobile Card View */}
      <div className="md:hidden rounded-lg border bg-white shadow divide-y divide-gray-200">
        {loading ? (
          <div className="px-4 py-8 text-center text-gray-500">Loading...</div>
        ) : accounts.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500">No accounts found</div>
        ) : (
          accounts.map((account) => {
            const getCardBgClass = (): string => {
              if (account.status === 'CLOSED') return 'bg-gray-100';
              if (account.status === 'HOLD') return 'bg-amber-50';
              if (account.auditFlag) return 'bg-yellow-50';
              return '';
            };

            return (
              <div
                key={account.id}
                onClick={() => router.push(`/accounts/${account.id}`)}
                className={`p-4 cursor-pointer active:bg-gray-100 ${getCardBgClass()}`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-mono font-bold text-postnet-red">
                      {account.needsIdUpdate && (
                        <span
                          className="mr-1 text-orange-500"
                          title="ID update needed"
                        >
                          <svg className="inline h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z" />
                          </svg>
                        </span>
                      )}
                      {account.auditFlag && (
                        <span
                          className={`mr-1 ${account.status === 'HOLD' ? 'text-red-500' : 'text-amber-500'}`}
                          title="Audit flag"
                        >
                          <svg className="inline h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                      {account.mailboxNumber}
                    </span>
                    <StatusBadge status={account.status} />
                  </div>
                  <div className="flex items-center gap-1">
                    {account.recipientType === 'BUSINESS' ? (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                        Biz
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        Per
                      </span>
                    )}
                    <span className="text-xs text-gray-500">×{account.recipientCount}</span>
                  </div>
                </div>
                <div className="text-sm text-gray-900 mb-2">{account.name}</div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{formatRenewalPeriod(account.renewalPeriod)} • {format(new Date(account.nextRenewalDate), 'MM/dd/yy')}</span>
                  <span className="font-mono font-medium text-gray-900">${Number(account.currentRate).toFixed(2)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto rounded-lg border bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-postnet-gray-light align-bottom">
            <tr>
              <th
                onClick={() => handleSort('mailboxNumber')}
                className="cursor-pointer px-4 py-3 text-center text-xs font-medium uppercase text-postnet-gray hover:bg-gray-200 transition-colors"
              >
                Mailbox
                <SortIcon field="mailboxNumber" sortField={sortField} sortOrder={sortOrder} />
              </th>
              <th
                onClick={() => handleSort('name')}
                className="cursor-pointer px-4 py-3 text-center text-xs font-medium uppercase text-postnet-gray hover:bg-gray-200 transition-colors"
              >
                Name
                <SortIcon field="name" sortField={sortField} sortOrder={sortOrder} />
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase text-postnet-gray">
                Recipients
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase text-postnet-gray">
                Type
              </th>
              <th
                onClick={() => handleSort('status')}
                className="cursor-pointer px-4 py-3 text-center text-xs font-medium uppercase text-postnet-gray hover:bg-gray-200 transition-colors"
              >
                Status
                <SortIcon field="status" sortField={sortField} sortOrder={sortOrder} />
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase text-postnet-gray">
                Term
              </th>
              <th
                onClick={() => handleSort('nextRenewalDate')}
                className="cursor-pointer px-4 py-3 text-center text-xs font-medium uppercase text-postnet-gray hover:bg-gray-200 transition-colors"
              >
                Next Renewal
                <SortIcon field="nextRenewalDate" sortField={sortField} sortOrder={sortOrder} />
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase text-postnet-gray">
                Rate
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : accounts.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  No accounts found
                </td>
              </tr>
            ) : (
              accounts.map((account) => {
                // Determine row background color based on account issues
                const getRowBgClass = (): string => {
                  if (account.status === 'CLOSED') return 'bg-gray-100 hover:bg-gray-150';
                  if (account.status === 'HOLD') return 'bg-amber-50 hover:bg-amber-100';
                  if (account.auditFlag) return 'bg-yellow-50 hover:bg-yellow-100';
                  return 'hover:bg-gray-50';
                };

                return (
                <tr
                  key={account.id}
                  onClick={() => router.push(`/accounts/${account.id}`)}
                  className={`cursor-pointer ${getRowBgClass()}`}
                >
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-postnet-charcoal font-mono">
                    <span className="inline-flex items-center gap-1">
                      {account.needsIdUpdate && (
                        <span
                          className="text-orange-500"
                          title="ID update needed"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z" />
                          </svg>
                        </span>
                      )}
                      {account.auditFlag && (
                        <span
                          className={account.status === 'HOLD' ? 'text-red-500' : 'text-amber-500'}
                          title="Audit flag"
                        >
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                      {account.mailboxNumber}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-postnet-charcoal">{account.name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-500 font-mono">
                    {account.recipientCount}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-center text-sm">
                    {account.recipientType === 'BUSINESS' ? (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                        Business
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        Personal
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <StatusBadge status={account.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                    {formatRenewalPeriod(account.renewalPeriod)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                    {format(new Date(account.nextRenewalDate), 'MM/dd/yyyy')}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-postnet-charcoal">
                    ${Number(account.currentRate).toFixed(2)}
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.total > 0 && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
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
              {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </span>
          </div>

          <div className="flex items-center justify-center gap-4 sm:justify-end">
            <span className="hidden text-sm text-gray-700 sm:inline">
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
                {pagination.page} / {pagination.totalPages}
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

function AccountsTableFallback(): React.ReactElement {
  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="h-8 w-28 animate-pulse rounded-lg bg-gray-200" />
        <div className="flex-1 max-w-xl h-10 animate-pulse rounded-lg bg-gray-200" />
        <div className="h-10 w-32 animate-pulse rounded-lg bg-gray-200" />
      </div>
      <div className="overflow-hidden rounded-lg border bg-white shadow">
        <div className="h-64 animate-pulse bg-gray-100" />
      </div>
    </div>
  );
}

export default function AccountsPage(): React.ReactElement {
  return (
    <AppLayout>
      <Suspense fallback={<AccountsTableFallback />}>
        <AccountsTableContent />
      </Suspense>
    </AppLayout>
  );
}
