'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { NOTICE_TYPE_CODE_LABELS } from '@/constants/notice';
import type { SerializedNoticeType } from '@/types/notice';

interface NoticeTypeListProps {
  noticeTypes: SerializedNoticeType[];
  isLoading: boolean;
  onEdit: (noticeType: SerializedNoticeType) => void;
  onDelete: (id: string) => void;
  onGenerate: (noticeType: SerializedNoticeType) => void;
  isManager: boolean;
}

export function NoticeTypeList({
  noticeTypes,
  isLoading,
  onEdit,
  onDelete,
  onGenerate,
  isManager,
}: NoticeTypeListProps): React.ReactElement {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string): Promise<void> => {
    if (deletingId) return;
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-4 border border-gray-200 rounded-lg animate-pulse"
          >
            <div className="h-5 w-40 bg-gray-200 rounded mb-2" />
            <div className="h-4 w-full bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (noticeTypes.length === 0) {
    return (
      <div className="text-center py-8 text-postnet-gray">
        <p>No notice types found.</p>
        {isManager && (
          <p className="text-sm mt-2">
            Click &quot;Seed Default Templates&quot; to create the default notice types.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {noticeTypes.map((noticeType) => (
        <div
          key={noticeType.id}
          className={`p-4 border rounded-lg transition-colors ${
            noticeType.isActive
              ? 'border-gray-200 bg-white hover:border-postnet-red/30'
              : 'border-gray-200 bg-gray-50 opacity-60'
          }`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-postnet-charcoal">
                  {noticeType.name}
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-postnet-red/10 text-postnet-red">
                  {NOTICE_TYPE_CODE_LABELS[noticeType.code]}
                </span>
                {noticeType.isSystem && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    System
                  </span>
                )}
                {!noticeType.isActive && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                    Inactive
                  </span>
                )}
              </div>
              {noticeType.description && (
                <p className="text-sm text-postnet-gray mt-1">
                  {noticeType.description}
                </p>
              )}
              {noticeType.subject && (
                <p className="text-xs text-postnet-gray mt-1 break-words">
                  <span className="font-medium">Subject:</span> {noticeType.subject}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:ml-4 sm:flex-nowrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onGenerate(noticeType)}
                disabled={!noticeType.isActive}
              >
                Generate
              </Button>
              {isManager && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(noticeType)}
                  >
                    Edit
                  </Button>
                  {!noticeType.isSystem && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleDelete(noticeType.id)}
                      disabled={deletingId === noticeType.id}
                      className="text-red-600 hover:text-red-700 hover:border-red-300"
                    >
                      {deletingId === noticeType.id ? '...' : 'Delete'}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
