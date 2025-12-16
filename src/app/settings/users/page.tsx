'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout';
import { UserEditDialog, type UserEditData, type UserForEdit } from '@/components/users/UserEditDialog';
import { format } from 'date-fns';

interface PhoneNumber {
  id: string;
  e164Format: string;
  isMobile: boolean;
  isPrimary: boolean;
}

interface EmailAddress {
  id: string;
  email: string;
  isPrimary: boolean;
}

interface User {
  id: string;
  username: string;
  email: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  role: 'STAFF' | 'MANAGER';
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
  phoneNumbers: PhoneNumber[];
  emailAddresses: EmailAddress[];
}

function RoleBadge({ role }: { role: string }): React.ReactElement {
  const isManager = role === 'MANAGER';
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        isManager ? 'bg-postnet-red/10 text-postnet-red' : 'bg-postnet-gray-light text-postnet-charcoal'
      }`}
    >
      {role}
    </span>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }): React.ReactElement {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        isActive ? 'bg-status-active/10 text-status-active' : 'bg-status-closed/10 text-status-closed'
      }`}
    >
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

export default function UsersSettingsPage(): React.ReactElement {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isManager, setIsManager] = useState<boolean | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserForEdit | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchUsers = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/users');
      if (res.status === 403) {
        setIsManager(false);
        return;
      }
      if (!res.ok) {
        throw new Error('Failed to fetch users');
      }
      const json = await res.json() as { data: User[] };
      setUsers(json.data);
      setIsManager(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const handleAddUser = (): void => {
    setEditingUser(null);
    setSaveError(null);
    setDialogOpen(true);
  };

  const handleEditUser = (user: User): void => {
    setEditingUser({
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      middleName: user.middleName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
      phoneNumbers: user.phoneNumbers,
      emailAddresses: user.emailAddresses,
    });
    setSaveError(null);
    setDialogOpen(true);
  };

  const handleCloseDialog = (): void => {
    setDialogOpen(false);
    setEditingUser(null);
    setSaveError(null);
  };

  const handleSaveUser = async (data: UserEditData): Promise<void> => {
    setSaving(true);
    setSaveError(null);

    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      const method = editingUser ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json() as { error: string };
        throw new Error(errorData.error ?? 'Failed to save user');
      }

      handleCloseDialog();
      void fetchUsers();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (user: User): Promise<void> => {
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      });

      if (!res.ok) {
        const errorData = await res.json() as { error: string };
        alert(errorData.error ?? 'Failed to update user');
        return;
      }

      void fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  // Show access denied if not manager
  if (isManager === false) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-16">
          <h1 className="text-xl font-semibold text-postnet-charcoal">Access Denied</h1>
          <p className="mt-2 text-postnet-gray">You must be a manager to access user administration.</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 rounded-md bg-postnet-red px-4 py-2 text-sm text-white hover:bg-postnet-red-dark"
          >
            Return to Dashboard
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-postnet-charcoal">User Administration</h1>
            <p className="text-sm text-postnet-gray">Manage user accounts and permissions</p>
          </div>
          <button
            onClick={handleAddUser}
            className="rounded-md bg-postnet-red px-4 py-2 text-sm text-white hover:bg-postnet-red-dark"
          >
            + Add User
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-4 rounded-md">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border bg-white shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-postnet-gray-light">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-postnet-gray">
                  Username
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-postnet-gray">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-postnet-gray">
                  Contact
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase text-postnet-gray">
                  Role
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase text-postnet-gray">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-postnet-gray">
                  Last Login
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase text-postnet-gray">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const fullName = [user.firstName, user.middleName, user.lastName]
                    .filter(Boolean)
                    .join(' ') || '—';
                  const primaryPhone = user.phoneNumbers.find((p) => p.isPrimary) ?? user.phoneNumbers[0];
                  const primaryEmail = user.emailAddresses.find((e) => e.isPrimary) ?? user.emailAddresses[0];

                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                        {user.username}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {fullName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        <div className="space-y-0.5">
                          <div className="text-gray-900">{user.email}</div>
                          {primaryPhone && (
                            <div className="text-xs font-mono">{primaryPhone.e164Format}</div>
                          )}
                          {primaryEmail && (
                            <div className="text-xs">{primaryEmail.email}</div>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center text-sm">
                        <RoleBadge role={user.role} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center text-sm">
                        <StatusBadge isActive={user.isActive} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                        {user.lastLogin
                          ? format(new Date(user.lastLogin), 'MM/dd/yyyy HH:mm')
                          : 'Never'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center text-sm">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEditUser(user)}
                            className="text-postnet-red hover:text-postnet-red-dark"
                            title="Edit user"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                            </svg>
                          </button>
                          <button
                            onClick={() => void handleToggleActive(user)}
                            className={user.isActive ? 'text-amber-600 hover:text-amber-700' : 'text-green-600 hover:text-green-700'}
                            title={user.isActive ? 'Deactivate user' : 'Reactivate user'}
                          >
                            {user.isActive ? (
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            ) : (
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* User count summary */}
        {!loading && users.length > 0 && (
          <div className="text-sm text-gray-500">
            Showing {users.length} user{users.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Edit/Create Dialog */}
      <UserEditDialog
        isOpen={dialogOpen}
        user={editingUser}
        onClose={handleCloseDialog}
        onSave={(data) => void handleSaveUser(data)}
        isSaving={saving}
      />

      {/* Save Error Toast */}
      {saveError && (
        <div className="fixed bottom-4 right-4 rounded-lg bg-red-600 px-4 py-2 text-white shadow-lg">
          {saveError}
          <button
            onClick={() => setSaveError(null)}
            className="ml-3 font-bold"
          >
            ×
          </button>
        </div>
      )}
    </AppLayout>
  );
}
