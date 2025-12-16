'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'selectedMailboxes';

export interface SelectedMailbox {
  id: string;
  number: number;
}

/**
 * Load selected mailboxes from localStorage synchronously
 */
function loadFromStorage(): SelectedMailbox[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as SelectedMailbox[];
    }
  } catch {
    // Ignore parse errors
  }
  return [];
}

/**
 * Hook to manage selected mailboxes for label printing.
 * Persists selections in localStorage across page navigations.
 */
export function useSelectedMailboxes(): {
  selectedMailboxes: SelectedMailbox[];
  isSelected: (id: string) => boolean;
  toggle: (mailbox: SelectedMailbox) => void;
  clearAll: () => void;
  count: number;
  isLoaded: boolean;
} {
  const [selectedMailboxes, setSelectedMailboxes] = useState<SelectedMailbox[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = loadFromStorage();
    setSelectedMailboxes(stored);
    setIsLoaded(true);
  }, []);

  // Save to localStorage whenever selection changes (only after initial load)
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedMailboxes));
    }
  }, [selectedMailboxes, isLoaded]);

  const isSelected = useCallback(
    (id: string): boolean => {
      return selectedMailboxes.some((m) => m.id === id);
    },
    [selectedMailboxes]
  );

  const toggle = useCallback((mailbox: SelectedMailbox): void => {
    setSelectedMailboxes((prev) => {
      const exists = prev.some((m) => m.id === mailbox.id);
      if (exists) {
        return prev.filter((m) => m.id !== mailbox.id);
      }
      // Add and sort by mailbox number
      return [...prev, mailbox].sort((a, b) => a.number - b.number);
    });
  }, []);

  const clearAll = useCallback((): void => {
    setSelectedMailboxes([]);
  }, []);

  return {
    selectedMailboxes,
    isSelected,
    toggle,
    clearAll,
    count: selectedMailboxes.length,
    isLoaded,
  };
}
