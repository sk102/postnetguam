'use client';

import { useState, useEffect } from 'react';

interface Mailbox {
  id: string;
  number: number;
}

interface MailboxReassignDialogProps {
  isOpen: boolean;
  currentMailbox: Mailbox | null;
  onClose: () => void;
  onSave: (mailboxId: string) => void;
}

export function MailboxReassignDialog({
  isOpen,
  currentMailbox,
  onClose,
  onSave,
}: MailboxReassignDialogProps): React.ReactElement | null {
  const [availableMailboxes, setAvailableMailboxes] = useState<Mailbox[]>([]);
  const [selectedMailboxId, setSelectedMailboxId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [searchNumber, setSearchNumber] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedMailboxId('');
      setSearchNumber('');
      fetchAvailableMailboxes();
    }
  }, [isOpen]);

  const fetchAvailableMailboxes = async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await fetch('/api/mailboxes?status=AVAILABLE&limit=100');
      if (res.ok) {
        const data = await res.json() as { data: Mailbox[] };
        setAvailableMailboxes(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch available mailboxes:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !currentMailbox) return null;

  const filteredMailboxes = searchNumber
    ? availableMailboxes.filter((m) => m.number.toString().includes(searchNumber))
    : availableMailboxes;

  const handleSave = (): void => {
    if (selectedMailboxId) {
      onSave(selectedMailboxId);
    }
  };

  const selectedMailbox = availableMailboxes.find((m) => m.id === selectedMailboxId);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Dialog */}
        <div className="relative w-full max-w-md rounded-lg bg-white shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Reassign Mailbox
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-4">
            {/* Current Mailbox */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Current Mailbox</p>
              <p className="text-lg font-semibold font-mono">
                #{currentMailbox.number}
              </p>
            </div>

            {/* Search */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search Available Mailboxes
              </label>
              <input
                type="text"
                value={searchNumber}
                onChange={(e) => setSearchNumber(e.target.value)}
                placeholder="Enter mailbox number..."
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>

            {/* Available Mailboxes */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select New Mailbox
              </label>
              {loading ? (
                <div className="text-center py-4 text-gray-500">Loading...</div>
              ) : filteredMailboxes.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  {searchNumber ? 'No matching mailboxes found' : 'No available mailboxes'}
                </div>
              ) : (
                <div className="border rounded-md overflow-hidden">
                  {/* List */}
                  <div className="max-h-48 overflow-y-auto divide-y">
                    {filteredMailboxes.map((mailbox) => (
                      <button
                        key={mailbox.id}
                        onClick={() => setSelectedMailboxId(mailbox.id)}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center ${
                          selectedMailboxId === mailbox.id ? 'bg-postnet-red/10 border-l-2 border-postnet-red' : ''
                        }`}
                      >
                        <span className="font-mono font-medium">#{mailbox.number}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Selected Preview */}
            {selectedMailbox && (
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-700">
                  Will reassign to mailbox <span className="font-mono font-bold">#{selectedMailbox.number}</span>
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t px-6 py-4">
            <button
              onClick={onClose}
              className="rounded-md border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!selectedMailboxId}
              className="rounded-md bg-postnet-red px-4 py-2 text-sm text-white hover:bg-postnet-red-dark disabled:opacity-50"
            >
              Reassign Mailbox
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
