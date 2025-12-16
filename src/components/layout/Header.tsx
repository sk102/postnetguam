'use client';

import { signOut, useSession } from 'next-auth/react';

interface HeaderProps {
  onMenuClick: () => void;
}

function MenuIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
  );
}

export function Header({ onMenuClick }: HeaderProps): React.ReactElement {
  const { data: session } = useSession();

  return (
    <header className="flex h-14 sm:h-16 items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-6">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="rounded-md p-2 text-postnet-charcoal hover:bg-postnet-gray-light lg:hidden"
        aria-label="Open menu"
      >
        <MenuIcon className="h-6 w-6" />
      </button>

      {/* Desktop spacer */}
      <div className="hidden lg:block" />

      {/* User info */}
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex h-8 w-8 items-center justify-center rounded-full bg-postnet-gray-light">
            <UserIcon className="h-4 w-4 text-postnet-charcoal" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-postnet-charcoal">
              <span className="hidden sm:inline">{session?.user?.username}</span>
              <span className="sm:hidden">{session?.user?.username?.slice(0, 10)}</span>
            </span>
            <span className="text-xs text-postnet-gray">
              {session?.user?.role}
            </span>
          </div>
        </div>
        <div className="h-8 w-px bg-gray-200" />
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="rounded px-3 py-1.5 text-sm font-medium text-postnet-charcoal hover:bg-postnet-gray-light hover:text-postnet-red transition-colors"
        >
          Sign Out
        </button>
      </div>
    </header>
  );
}
