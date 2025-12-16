'use client';

import { useState, useEffect } from 'react';
import {
  TEMPLATE_VARIABLES,
  TEMPLATE_VARIABLE_CATEGORY_LABELS,
} from '@/constants/notice';
import type { TemplateVariableCategory } from '@/types/notice';

interface NoticeVariablesPanelProps {
  onInsert?: (variableName: string) => void;
}

export function NoticeVariablesPanel({
  onInsert,
}: NoticeVariablesPanelProps): React.ReactElement {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['account', 'recipient'])
  );
  const [copiedVariable, setCopiedVariable] = useState<string | null>(null);

  const toggleCategory = (category: string): void => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const handleCopy = (variableName: string): void => {
    void navigator.clipboard.writeText(`{{${variableName}}}`);
    setCopiedVariable(variableName);
  };

  useEffect(() => {
    if (copiedVariable) {
      const timer = setTimeout(() => setCopiedVariable(null), 2000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [copiedVariable]);

  const variablesByCategory = TEMPLATE_VARIABLES.reduce(
    (acc, variable) => {
      if (!acc[variable.category]) {
        acc[variable.category] = [];
      }
      acc[variable.category].push(variable);
      return acc;
    },
    {} as Record<TemplateVariableCategory, typeof TEMPLATE_VARIABLES>
  );

  const categories = Object.keys(
    TEMPLATE_VARIABLE_CATEGORY_LABELS
  ) as TemplateVariableCategory[];

  return (
    <div className="p-4">
      <h3 className="font-semibold text-postnet-charcoal mb-3">
        Available Variables
      </h3>
      <p className="text-xs text-gray-500 mb-4">
        Click to copy or insert variables into your template. Use the format{' '}
        <code className="bg-gray-100 px-1 rounded">{`{{variableName}}`}</code>
      </p>

      <div className="space-y-2">
        {categories.map((category) => {
          const variables = variablesByCategory[category] ?? [];
          if (variables.length === 0) return null;

          const isExpanded = expandedCategories.has(category);

          return (
            <div key={category} className="border rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => toggleCategory(category)}
                className="w-full px-3 py-2 text-left bg-gray-50 hover:bg-gray-100 flex items-center justify-between"
              >
                <span className="font-medium text-sm">
                  {TEMPLATE_VARIABLE_CATEGORY_LABELS[category]}
                </span>
                <svg
                  className={`w-4 h-4 transform transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {isExpanded && (
                <div className="divide-y">
                  {variables.map((variable) => (
                    <div
                      key={variable.name}
                      className="px-3 py-2 hover:bg-blue-50 cursor-pointer"
                      onClick={() => {
                        if (onInsert) {
                          onInsert(variable.name);
                        } else {
                          handleCopy(variable.name);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-postnet-red">
                          {`{{${variable.name}}}`}
                        </code>
                        {copiedVariable === variable.name && (
                          <span className="text-xs text-green-600">
                            Copied!
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        {variable.description}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Example: {variable.example}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
