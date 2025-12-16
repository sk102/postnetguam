'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { NoticeVariablesPanel } from './NoticeVariablesPanel';
import { NoticePreview } from './NoticePreview';
import type { SerializedNoticeType } from '@/types/notice';
import type { NoticeTypeCode } from '@prisma/client';
import { NOTICE_TYPE_CODE_LABELS } from '@/constants/notice';

interface NoticeTypeEditorProps {
  noticeType: SerializedNoticeType | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

const NOTICE_TYPE_CODES: NoticeTypeCode[] = [
  'RENEWAL_NOTICE',
  'UPCOMING_18TH_BIRTHDAY',
  'BIRTHDAY',
  'HOLD_NOTICE',
  'ID_VERIFICATION_REQUEST',
  'CUSTOM',
];

export function NoticeTypeEditor({
  noticeType,
  isOpen,
  onClose,
  onSave,
}: NoticeTypeEditorProps): React.ReactElement | null {
  const [formData, setFormData] = useState({
    code: 'CUSTOM' as NoticeTypeCode,
    name: '',
    description: '',
    subject: '',
    template: '',
    isActive: true,
  });
  const [showPreview, setShowPreview] = useState(false);
  const [showVariables, setShowVariables] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when opening/closing or when noticeType changes
  useEffect(() => {
    if (isOpen && noticeType) {
      setFormData({
        code: noticeType.code,
        name: noticeType.name,
        description: noticeType.description ?? '',
        subject: noticeType.subject ?? '',
        template: noticeType.template,
        isActive: noticeType.isActive,
      });
    } else if (isOpen && !noticeType) {
      setFormData({
        code: 'CUSTOM',
        name: '',
        description: '',
        subject: '',
        template: '',
        isActive: true,
      });
    }
    setError(null);
    setShowPreview(false);
  }, [isOpen, noticeType]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const url = noticeType
        ? `/api/notices/types/${noticeType.id}`
        : '/api/notices/types';
      const method = noticeType ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: formData.code,
          name: formData.name,
          description: formData.description || undefined,
          subject: formData.subject || undefined,
          template: formData.template,
          isActive: formData.isActive,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? 'Failed to save notice type');
      }

      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const insertVariable = useCallback((variableName: string): void => {
    const textarea = document.getElementById('template-textarea') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = formData.template;
      const before = text.substring(0, start);
      const after = text.substring(end);
      const newText = `${before}{{${variableName}}}${after}`;
      setFormData((prev) => ({ ...prev, template: newText }));
      // Focus and set cursor position after the inserted variable
      setTimeout(() => {
        textarea.focus();
        const newPosition = start + variableName.length + 4;
        textarea.setSelectionRange(newPosition, newPosition);
      }, 0);
    }
  }, [formData.template]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold text-postnet-charcoal">
            {noticeType ? 'Edit Notice Type' : 'Create Notice Type'}
          </h2>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowVariables(!showVariables)}
            >
              {showVariables ? 'Hide Variables' : 'Show Variables'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? 'Hide Preview' : 'Show Preview'}
            </Button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Form */}
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className={`flex-1 overflow-y-auto p-4 space-y-4 ${
              showVariables || showPreview ? 'border-r' : ''
            }`}
          >
            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
                {error}
              </div>
            )}

            {/* Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type Code
              </label>
              <select
                value={formData.code}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    code: e.target.value as NoticeTypeCode,
                  }))
                }
                disabled={!!noticeType}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-postnet-red/50 disabled:bg-gray-100"
              >
                {NOTICE_TYPE_CODES.map((code) => (
                  <option key={code} value={code}>
                    {NOTICE_TYPE_CODE_LABELS[code]}
                  </option>
                ))}
              </select>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-postnet-red/50"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-postnet-red/50"
              />
            </div>

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Subject (supports variables)
              </label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, subject: e.target.value }))
                }
                placeholder="e.g., Mailbox {{mailboxNumber}} - Renewal Notice"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-postnet-red/50"
              />
            </div>

            {/* Template */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Template (Markdown) *
              </label>
              <textarea
                id="template-textarea"
                value={formData.template}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, template: e.target.value }))
                }
                required
                rows={15}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-postnet-red/50 font-mono text-sm"
                placeholder="# Notice Title&#10;&#10;Dear {{displayName}},&#10;&#10;Your mailbox **#{{mailboxNumber}}** is due for renewal...&#10;&#10;## Details&#10;&#10;| Field | Value |&#10;|---|---|&#10;| **Rate** | {{currentRate}} |"
              />
              <p className="text-xs text-gray-500 mt-1">
                Use {`{{variableName}}`} to insert dynamic values. Supports
                Markdown formatting including tables.
              </p>
            </div>

            {/* Active */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    isActive: e.target.checked,
                  }))
                }
                className="h-4 w-4 text-postnet-red focus:ring-postnet-red border-gray-300 rounded"
              />
              <label
                htmlFor="isActive"
                className="ml-2 text-sm text-gray-700"
              >
                Active (available for notice generation)
              </label>
            </div>
          </form>

          {/* Variables Panel */}
          {showVariables && (
            <div className="w-80 overflow-y-auto border-r">
              <NoticeVariablesPanel onInsert={insertVariable} />
            </div>
          )}

          {/* Preview Panel */}
          {showPreview && (
            <div className="w-96 overflow-y-auto">
              <NoticePreview
                template={formData.template}
                subject={formData.subject}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={(e) => {
              e.preventDefault();
              const form = document.querySelector('form');
              if (form) {
                form.requestSubmit();
              }
            }}
            disabled={saving}
          >
            {saving ? 'Saving...' : noticeType ? 'Save Changes' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  );
}
