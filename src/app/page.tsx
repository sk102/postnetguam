'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout';

interface AccountStats {
  active: number;
  renewal: number;
  hold: number;
  closed: number;
  total: number;
  auditFlagged: number;
}

function StatusCard({
  title,
  count,
  href,
  colorClass,
  alertWhenPositive = false,
}: {
  title: string;
  count: number | null;
  href: string;
  colorClass: string;
  alertWhenPositive?: boolean;
}): React.ReactElement {
  const showAlert = alertWhenPositive && count !== null && count > 0;
  return (
    <Link
      href={href}
      className="flex flex-col rounded-lg border border-gray-200 bg-white p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-postnet-red/30 transition-all"
    >
      <span className={`inline-flex self-start rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}>
        {title}
      </span>
      <p className={`mt-3 text-2xl sm:text-3xl font-bold font-mono ${showAlert ? 'text-postnet-red' : 'text-postnet-charcoal'}`}>
        {count !== null ? count.toLocaleString() : '—'}
      </p>
    </Link>
  );
}

function QuickActionCard({
  title,
  description,
  href,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}): React.ReactElement {
  return (
    <Link
      href={href}
      className="flex items-start gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-postnet-red/30 transition-all group"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-postnet-red/10 text-postnet-red group-hover:bg-postnet-red group-hover:text-white transition-colors">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-postnet-charcoal">{title}</h3>
        <p className="mt-1 text-sm text-postnet-gray">{description}</p>
      </div>
    </Link>
  );
}

function Dashboard(): React.ReactElement {
  const [stats, setStats] = useState<AccountStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async (): Promise<void> => {
      try {
        const res = await fetch('/api/accounts/stats');
        if (res.ok) {
          const data = await res.json() as AccountStats;
          setStats(data);
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      } finally {
        setLoading(false);
      }
    };
    void fetchStats();
  }, []);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-postnet-charcoal var(--font-roboto-slab)">
          Dashboard
        </h1>
        <p className="mt-1 text-postnet-gray">
          Welcome to PostNet Customer Management System
        </p>
      </div>

      {/* Account Status Section */}
      <div>
        <h2 className="text-lg font-semibold text-postnet-charcoal mb-4">Account Status</h2>
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 sm:gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex flex-col rounded-lg border border-gray-200 bg-white p-4 sm:p-5 shadow-sm animate-pulse">
                <div className="h-5 w-16 bg-gray-200 rounded-full" />
                <div className="mt-3 h-8 w-14 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 sm:gap-4">
            <StatusCard
              title="Active"
              count={stats?.active ?? null}
              href="/accounts?status=ACTIVE"
              colorClass="bg-status-active/10 text-status-active"
            />
            <StatusCard
              title="Renewal"
              count={stats?.renewal ?? null}
              href="/accounts?status=RENEWAL"
              colorClass="bg-status-renewal/10 text-status-renewal"
              alertWhenPositive
            />
            <StatusCard
              title="Hold"
              count={stats?.hold ?? null}
              href="/accounts?status=HOLD"
              colorClass="bg-status-hold/10 text-status-hold"
              alertWhenPositive
            />
            <StatusCard
              title="Closed"
              count={stats?.closed ?? null}
              href="/accounts?status=CLOSED"
              colorClass="bg-status-closed/10 text-status-closed"
            />
            <StatusCard
              title="Total"
              count={stats?.total ?? null}
              href="/accounts"
              colorClass="bg-postnet-red/10 text-postnet-red"
            />
            <StatusCard
              title="Audit Flags"
              count={stats?.auditFlagged ?? null}
              href="/settings/audit"
              colorClass="bg-status-due/10 text-status-due"
              alertWhenPositive
            />
          </div>
        )}
      </div>

      {/* Quick Actions Section */}
      <div>
        <h2 className="text-lg font-semibold text-postnet-charcoal mb-4">Quick Actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <QuickActionCard
            title="New Account"
            description="Create a new customer account"
            href="/accounts/new"
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
              </svg>
            }
          />
          <QuickActionCard
            title="View Mailboxes"
            description="Browse and manage mailbox inventory"
            href="/mailboxes"
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
            }
          />
          <QuickActionCard
            title="Review Audits"
            description="Check accounts flagged for verification"
            href="/settings/audit"
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              </svg>
            }
          />
        </div>
      </div>
    </div>
  );
}

export default function Home(): React.ReactElement {
  return (
    <AppLayout>
      <Dashboard />
    </AppLayout>
  );
}
