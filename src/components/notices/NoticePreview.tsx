'use client';

import { useState, useEffect, useCallback } from 'react';

interface NoticePreviewProps {
  template: string;
  subject?: string;
  accountId?: string;
}

interface PreviewResponse {
  renderedContent: string;
  renderedSubject: string | null;
  variables: Record<string, unknown>;
}

export function NoticePreview({
  template,
  subject,
  accountId,
}: NoticePreviewProps): React.ReactElement {
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState(accountId ?? '');
  const [accounts, setAccounts] = useState<
    Array<{ id: string; mailboxNumber: number; displayName: string }>
  >([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // Fetch accounts for selection
  useEffect(() => {
    const fetchAccounts = async (): Promise<void> => {
      try {
        const response = await fetch('/api/notices/accounts?pageSize=20');
        if (response.ok) {
          const data = await response.json();
          setAccounts(
            data.data.map(
              (a: {
                id: string;
                mailboxNumber: number;
                primaryRecipient: { displayName: string } | null;
              }) => ({
                id: a.id,
                mailboxNumber: a.mailboxNumber,
                displayName: a.primaryRecipient?.displayName ?? 'No recipient',
              })
            )
          );
          // Auto-select first account if none selected
          if (!selectedAccountId && data.data.length > 0) {
            setSelectedAccountId(data.data[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch accounts:', err);
      } finally {
        setLoadingAccounts(false);
      }
    };

    void fetchAccounts();
  }, [selectedAccountId]);

  // Fetch preview
  const fetchPreview = useCallback(async (): Promise<void> => {
    if (!template || !selectedAccountId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/notices/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template,
          subject,
          accountId: selectedAccountId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? 'Failed to fetch preview');
      }

      const data = (await response.json()) as PreviewResponse;
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preview');
    } finally {
      setLoading(false);
    }
  }, [template, subject, selectedAccountId]);

  // Debounce preview updates
  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchPreview();
    }, 500);

    return () => clearTimeout(timer);
  }, [fetchPreview]);

  return (
    <div className="p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-postnet-charcoal">Preview</h3>
        <button
          type="button"
          onClick={() => void fetchPreview()}
          className="text-xs text-postnet-red hover:underline"
        >
          Refresh
        </button>
      </div>

      {/* Account Selector */}
      <div className="mb-3">
        <label className="block text-xs text-gray-500 mb-1">
          Preview with account:
        </label>
        {loadingAccounts ? (
          <div className="h-9 bg-gray-100 rounded animate-pulse" />
        ) : (
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-postnet-red/50"
          >
            <option value="">Select an account...</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                Box #{account.mailboxNumber} - {account.displayName}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Preview Content */}
      <div className="flex-1 overflow-y-auto border rounded-lg bg-white">
        {loading ? (
          <div className="p-4 space-y-2 animate-pulse">
            <div className="h-6 w-48 bg-gray-200 rounded" />
            <div className="h-4 w-full bg-gray-200 rounded" />
            <div className="h-4 w-3/4 bg-gray-200 rounded" />
          </div>
        ) : error ? (
          <div className="p-4 text-sm text-red-600">{error}</div>
        ) : !selectedAccountId ? (
          <div className="p-4 text-sm text-gray-500 text-center">
            Select an account to preview
          </div>
        ) : preview ? (
          <div className="p-4">
            {preview.renderedSubject && (
              <div className="mb-3 pb-3 border-b">
                <span className="text-xs text-gray-500">Subject:</span>
                <p className="font-medium text-sm">{preview.renderedSubject}</p>
              </div>
            )}
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: preview.renderedContent }}
            />
          </div>
        ) : (
          <div className="p-4 text-sm text-gray-500 text-center">
            Enter a template to see preview
          </div>
        )}
      </div>
    </div>
  );
}
