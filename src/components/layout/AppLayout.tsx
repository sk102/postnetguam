'use client';

import { useState } from 'react';
import { SessionProvider } from 'next-auth/react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function AppLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <SessionProvider>
      <div className="flex h-screen bg-postnet-gray-light">
        {/* Mobile sidebar overlay */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
            {children}
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}
