'use client';

import { useEffect, useState, useCallback } from 'react';
import { AppLayout } from '@/components/layout';
import {
  NoticeTypeList,
  NoticeTypeEditor,
  NoticeHistoryTable,
  NoticeVariablesPanel,
  NoticeGenerateDialog,
} from '@/components/notices';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import type { SerializedNoticeType } from '@/types/notice';

export default function NoticesSettingsPage(): React.ReactElement {
  const [noticeTypes, setNoticeTypes] = useState<SerializedNoticeType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isManager, setIsManager] = useState(false);

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingNoticeType, setEditingNoticeType] =
    useState<SerializedNoticeType | null>(null);

  // Generate dialog state
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [generatingNoticeType, setGeneratingNoticeType] =
    useState<SerializedNoticeType | null>(null);

  const fetchNoticeTypes = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/notices/types?includeInactive=true');

      if (!response.ok) {
        throw new Error('Failed to fetch notice types');
      }

      const data = await response.json();
      setNoticeTypes(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const checkManagerRole = useCallback(async (): Promise<void> => {
    try {
      // Check by trying to get users which is manager-only
      const usersResponse = await fetch('/api/users');
      setIsManager(usersResponse.ok);
    } catch {
      setIsManager(false);
    }
  }, []);

  useEffect(() => {
    void fetchNoticeTypes();
    void checkManagerRole();
  }, [fetchNoticeTypes, checkManagerRole]);

  const handleEdit = (noticeType: SerializedNoticeType): void => {
    setEditingNoticeType(noticeType);
    setEditorOpen(true);
  };

  const handleCreate = (): void => {
    setEditingNoticeType(null);
    setEditorOpen(true);
  };

  const handleDelete = async (id: string): Promise<void> => {
    if (!confirm('Are you sure you want to delete this notice type?')) return;

    try {
      const response = await fetch(`/api/notices/types/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? 'Failed to delete');
      }

      void fetchNoticeTypes();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleGenerate = (noticeType: SerializedNoticeType): void => {
    setGeneratingNoticeType(noticeType);
    setGenerateDialogOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-postnet-charcoal">
              Notice Management
            </h1>
            <p className="text-muted-foreground">
              Create and manage notice templates, generate notices for accounts
            </p>
          </div>
          {isManager && (
            <Button onClick={handleCreate}>Create Notice Type</Button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-4 rounded-md">
            {error}
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="templates" className="space-y-6">
          <TabsList>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="variables">Variables Reference</TabsTrigger>
          </TabsList>

          <TabsContent value="templates">
            <div className="bg-white rounded-lg border p-6">
              <NoticeTypeList
                noticeTypes={noticeTypes}
                isLoading={isLoading}
                onEdit={handleEdit}
                onDelete={(id) => void handleDelete(id)}
                onGenerate={handleGenerate}
                isManager={isManager}
              />
            </div>
          </TabsContent>

          <TabsContent value="history">
            <div className="bg-white rounded-lg border p-6">
              <NoticeHistoryTable isManager={isManager} />
            </div>
          </TabsContent>

          <TabsContent value="variables">
            <div className="bg-white rounded-lg border">
              <NoticeVariablesPanel />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Editor Dialog */}
      <NoticeTypeEditor
        noticeType={editingNoticeType}
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={() => void fetchNoticeTypes()}
      />

      {/* Generate Dialog */}
      <NoticeGenerateDialog
        noticeType={generatingNoticeType}
        isOpen={generateDialogOpen}
        onClose={() => setGenerateDialogOpen(false)}
        onGenerated={() => void fetchNoticeTypes()}
      />
    </AppLayout>
  );
}
