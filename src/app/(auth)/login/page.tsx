'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function LoginForm(): React.ReactElement {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid username or password');
      } else if (result?.ok) {
        window.location.href = callbackUrl;
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded bg-red-50 border border-red-200 p-4 text-sm text-postnet-red font-roboto">
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="username"
          className="block text-sm font-medium text-postnet-charcoal font-roboto mb-2"
        >
          Username
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoComplete="username"
          className="font-roboto block w-full border-2 border-gray-200 px-4 py-3 text-postnet-charcoal placeholder-gray-400 focus:border-postnet-red focus:outline-none transition-colors"
          placeholder="Enter your username"
          disabled={isLoading}
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-postnet-charcoal font-roboto mb-2"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="font-roboto block w-full border-2 border-gray-200 px-4 py-3 text-postnet-charcoal placeholder-gray-400 focus:border-postnet-red focus:outline-none transition-colors"
          placeholder="Enter your password"
          disabled={isLoading}
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="btn-postnet w-full py-4 disabled:cursor-not-allowed"
      >
        <span>{isLoading ? 'Signing in...' : 'Sign In'}</span>
      </button>
    </form>
  );
}

function LoginFormFallback(): React.ReactElement {
  return (
    <div className="space-y-6">
      <div className="h-14 animate-pulse rounded bg-gray-200" />
      <div className="h-14 animate-pulse rounded bg-gray-200" />
      <div className="h-14 animate-pulse rounded bg-gray-200" />
    </div>
  );
}

function PostNetLogo({ className = '' }: { className?: string }): React.ReactElement {
  return (
    <div className={`flex items-center ${className}`}>
      <span className="font-roboto-slab font-bold text-2xl">
        <span className="text-postnet-red">Post</span>
        <span className="text-white">Net Guam</span>
      </span>
    </div>
  );
}

export default function LoginPage(): React.ReactElement {
  return (
    <div className="min-h-screen flex flex-col bg-white font-roboto">
      {/* Header */}
      <header className="bg-postnet-charcoal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <PostNetLogo />
            <span className="text-gray-400 text-sm font-roboto hidden sm:block">
              Customer Management System
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex">
        {/* Left Panel - Branding */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-postnet-charcoal to-postnet-charcoal-light relative overflow-hidden">
          {/* Decorative skewed elements */}
          <div className="absolute inset-0">
            <div
              className="absolute top-0 right-0 w-full h-full bg-postnet-red opacity-10"
              style={{ transform: 'skewX(-13deg) translateX(50%)' }}
            />
            <div
              className="absolute bottom-0 left-0 w-2/3 h-1/2 bg-postnet-red opacity-5"
              style={{ transform: 'skewX(-13deg) translateX(-20%)' }}
            />
          </div>

          <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
            <div className="mb-8">
              <h2 className="font-roboto-slab text-4xl xl:text-5xl font-bold text-white mb-4">
                <span className="text-postnet-red">Post</span>Net Guam
              </h2>
              <p className="text-gray-300 text-lg font-roboto">
                Customer Management System
              </p>
            </div>

            <div className="space-y-6 text-gray-400">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded bg-postnet-red/20 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-5 h-5 text-postnet-red"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-medium mb-1">Mailbox Management</h3>
                  <p className="text-sm">Track and manage all mailbox rentals efficiently</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded bg-postnet-red/20 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-5 h-5 text-postnet-red"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-medium mb-1">Customer Accounts</h3>
                  <p className="text-sm">Comprehensive customer and recipient management</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded bg-postnet-red/20 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-5 h-5 text-postnet-red"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-medium mb-1">Compliance Ready</h3>
                  <p className="text-sm">Built-in verification and documentation tracking</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Login Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="lg:hidden text-center mb-8">
              <h1 className="font-roboto-slab text-3xl font-bold">
                <span className="text-postnet-red">Post</span>
                <span className="text-postnet-charcoal">Net</span>
              </h1>
              <p className="text-gray-500 text-sm mt-1 font-roboto">
                Customer Management System
              </p>
            </div>

            <div className="bg-white p-8 shadow-lg border border-gray-100">
              <div className="mb-8">
                <h2 className="font-roboto-slab text-2xl font-bold text-postnet-charcoal">
                  Welcome Back
                </h2>
                <p className="text-gray-500 mt-2 font-roboto">
                  Sign in to access your dashboard
                </p>
              </div>

              <Suspense fallback={<LoginFormFallback />}>
                <LoginForm />
              </Suspense>

              <div className="mt-8 pt-6 border-t border-gray-100">
                <p className="text-center text-xs text-gray-400 font-roboto">
                  Authorized personnel only. All access is logged and monitored.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-postnet-charcoal py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between text-sm text-gray-400">
            <p className="font-roboto">
              &copy; {new Date().getFullYear()} PostNet Guam. All rights reserved.
            </p>
            <p className="font-roboto mt-2 sm:mt-0">
              Customer Management System v1.0
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
