import React from 'react';
import path from 'path';
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  renderToBuffer,
  Font,
} from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';

// Font paths (relative to project root)
const FONTS_PATH = path.join(process.cwd(), 'public/fonts');

// Register Roboto font for body text (PostNet official font)
Font.register({
  family: 'Roboto',
  fonts: [
    {
      src: path.join(FONTS_PATH, 'Roboto-Regular.ttf'),
      fontWeight: 400,
    },
    {
      src: path.join(FONTS_PATH, 'Roboto-Bold.ttf'),
      fontWeight: 700,
    },
    {
      src: path.join(FONTS_PATH, 'Roboto-Italic.ttf'),
      fontWeight: 400,
      fontStyle: 'italic',
    },
    {
      src: path.join(FONTS_PATH, 'Roboto-BoldItalic.ttf'),
      fontWeight: 700,
      fontStyle: 'italic',
    },
  ],
});

// Register Roboto Slab font for headings (PostNet official heading font)
Font.register({
  family: 'Roboto Slab',
  src: path.join(FONTS_PATH, 'RobotoSlab-Bold.ttf'),
  fontWeight: 700,
});

// PostNet logo path (relative to project root)
const LOGO_PATH = path.join(process.cwd(), 'public/images/postnet-logo.png');

// PostNet brand colors (official from postnet.com)
const COLORS = {
  red: '#D11532', // Official PostNet red from logo
  charcoal: '#2D2D2D',
  gray: '#6B7280',
  lightGray: '#F3F4F6',
  white: '#FFFFFF',
};

// Define styles for the PDF document
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Roboto',
    fontSize: 11,
    lineHeight: 1.5,
    color: COLORS.charcoal,
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.red,
    paddingBottom: 15,
  },
  logo: {
    width: 150,
    height: 22,
    marginBottom: 8,
  },
  storeInfo: {
    fontSize: 9,
    color: COLORS.gray,
  },
  content: {
    marginTop: 10,
  },
  h1: {
    fontFamily: 'Roboto Slab',
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.charcoal,
    marginBottom: 15,
    marginTop: 10,
  },
  h2: {
    fontFamily: 'Roboto Slab',
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.charcoal,
    marginBottom: 10,
    marginTop: 15,
  },
  h3: {
    fontFamily: 'Roboto Slab',
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.charcoal,
    marginBottom: 8,
    marginTop: 12,
  },
  paragraph: {
    marginBottom: 4,
  },
  bold: {
    fontWeight: 'bold',
  },
  italic: {
    fontStyle: 'italic',
  },
  table: {
    width: '100%',
    marginTop: 10,
    marginBottom: 10,
  },
  tableRow: {
    flexDirection: 'row' as const,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    minHeight: 25,
    alignItems: 'center' as const,
  },
  tableHeader: {
    backgroundColor: COLORS.lightGray,
    fontWeight: 'bold',
  },
  tableCell: {
    flex: 1,
    padding: 5,
    fontSize: 10,
  },
  tableCellBold: {
    flex: 1,
    padding: 5,
    fontSize: 10,
    fontWeight: 'bold',
  },
  list: {
    marginLeft: 15,
    marginBottom: 10,
  },
  listItem: {
    flexDirection: 'row' as const,
    marginBottom: 3,
  },
  bullet: {
    width: 15,
    fontSize: 10,
  },
  listText: {
    flex: 1,
  },
  hr: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray,
    marginVertical: 15,
  },
  footer: {
    position: 'absolute' as const,
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center' as const,
    fontSize: 9,
    color: COLORS.gray,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    paddingTop: 10,
  },
});

/**
 * Parse simple markdown to PDF elements
 * This is a simplified parser that handles common markdown elements
 */
interface ParsedElement {
  type: 'h1' | 'h2' | 'h3' | 'paragraph' | 'table' | 'list' | 'hr';
  content: string;
  rows?: string[][];
  items?: string[];
}

function parseMarkdownToPdfElements(markdown: string): ParsedElement[] {
  const elements: ParsedElement[] = [];
  const lines = markdown.split('\n');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]?.trim() ?? '';

    // Skip empty lines
    if (!line) {
      i++;
      continue;
    }

    // Horizontal rule
    if (line.match(/^[-*_]{3,}$/)) {
      elements.push({ type: 'hr', content: '' });
      i++;
      continue;
    }

    // Headers
    if (line.startsWith('# ')) {
      elements.push({ type: 'h1', content: line.substring(2) });
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push({ type: 'h2', content: line.substring(3) });
      i++;
      continue;
    }
    if (line.startsWith('### ')) {
      elements.push({ type: 'h3', content: line.substring(4) });
      i++;
      continue;
    }

    // Tables (detect by |)
    if (line.startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length) {
        const tableLine = lines[i]?.trim() ?? '';
        if (!tableLine.startsWith('|')) break;

        // Skip separator rows (|---|---|)
        if (tableLine.match(/^\|[-:\s|]+\|$/)) {
          i++;
          continue;
        }

        const cells = tableLine
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim());
        if (cells.length > 0) {
          rows.push(cells);
        }
        i++;
      }
      if (rows.length > 0) {
        elements.push({ type: 'table', content: '', rows });
      }
      continue;
    }

    // Unordered lists
    if (line.match(/^[-*]\s/)) {
      const items: string[] = [];
      while (i < lines.length) {
        const listLine = lines[i]?.trim() ?? '';
        if (!listLine.match(/^[-*]\s/)) break;
        items.push(listLine.substring(2));
        i++;
      }
      if (items.length > 0) {
        elements.push({ type: 'list', content: '', items });
      }
      continue;
    }

    // Ordered lists
    if (line.match(/^\d+\.\s/)) {
      const items: string[] = [];
      while (i < lines.length) {
        const listLine = lines[i]?.trim() ?? '';
        const match = listLine.match(/^\d+\.\s(.*)$/);
        if (!match) break;
        items.push(match[1] ?? '');
        i++;
      }
      if (items.length > 0) {
        elements.push({ type: 'list', content: '', items });
      }
      continue;
    }

    // Regular paragraph - treat each line separately to match breaks:true behavior
    // This ensures single line breaks in markdown render as line breaks in PDF
    elements.push({ type: 'paragraph', content: line });
    i++;
  }

  return elements;
}

/**
 * Render text with inline formatting (bold, italic)
 */
function renderFormattedText(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining) {
    // Bold (**text** or __text__)
    const boldMatch = remaining.match(/\*\*(.+?)\*\*|__(.+?)__/);
    if (boldMatch) {
      const beforeBold = remaining.substring(0, boldMatch.index);
      if (beforeBold) {
        parts.push(React.createElement(Text, { key: key++ }, beforeBold));
      }
      parts.push(
        React.createElement(
          Text,
          { key: key++, style: styles.bold },
          boldMatch[1] || boldMatch[2]
        )
      );
      remaining = remaining.substring(
        (boldMatch.index ?? 0) + boldMatch[0].length
      );
      continue;
    }

    // Italic (*text* or _text_)
    const italicMatch = remaining.match(/\*(.+?)\*|_(.+?)_/);
    if (italicMatch) {
      const beforeItalic = remaining.substring(0, italicMatch.index);
      if (beforeItalic) {
        parts.push(React.createElement(Text, { key: key++ }, beforeItalic));
      }
      parts.push(
        React.createElement(
          Text,
          { key: key++, style: styles.italic },
          italicMatch[1] || italicMatch[2]
        )
      );
      remaining = remaining.substring(
        (italicMatch.index ?? 0) + italicMatch[0].length
      );
      continue;
    }

    // No more formatting, add remaining text
    parts.push(React.createElement(Text, { key: key++ }, remaining));
    break;
  }

  return parts;
}

/**
 * Notice PDF Document props
 */
interface NoticePdfDocumentProps {
  content: string;
  storeName: string;
  storeAddress: string;
  storePhone: string;
  generatedDate: string;
}

/**
 * Notice PDF Document component
 */
function NoticePdfDocument({
  content,
  storeName,
  storeAddress,
  storePhone,
  generatedDate: _generatedDate,
}: NoticePdfDocumentProps): React.ReactElement {
  const elements = parseMarkdownToPdfElements(content);

  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'LETTER', style: styles.page },
      // Header
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(Image, { style: styles.logo, src: LOGO_PATH }),
        React.createElement(Text, { style: styles.storeInfo }, storeAddress),
        React.createElement(Text, { style: styles.storeInfo }, storePhone)
      ),
      // Content
      React.createElement(
        View,
        { style: styles.content },
        elements.map((element, index) => {
          switch (element.type) {
            case 'h1':
              return React.createElement(
                Text,
                { key: index, style: styles.h1 },
                ...renderFormattedText(element.content)
              );
            case 'h2':
              return React.createElement(
                Text,
                { key: index, style: styles.h2 },
                ...renderFormattedText(element.content)
              );
            case 'h3':
              return React.createElement(
                Text,
                { key: index, style: styles.h3 },
                ...renderFormattedText(element.content)
              );
            case 'hr':
              return React.createElement(View, {
                key: index,
                style: styles.hr,
              });
            case 'table':
              return React.createElement(
                View,
                { key: index, style: styles.table },
                element.rows?.map((row, rowIndex) =>
                  React.createElement(
                    View,
                    {
                      key: rowIndex,
                      style: [
                        styles.tableRow,
                        rowIndex === 0 ? styles.tableHeader : {},
                      ] as Style[],
                    },
                    row.map((cell, cellIndex) =>
                      React.createElement(
                        Text,
                        {
                          key: cellIndex,
                          style:
                            cellIndex === 0
                              ? styles.tableCellBold
                              : styles.tableCell,
                        },
                        ...renderFormattedText(cell)
                      )
                    )
                  )
                )
              );
            case 'list':
              return React.createElement(
                View,
                { key: index, style: styles.list },
                element.items?.map((item, itemIndex) =>
                  React.createElement(
                    View,
                    { key: itemIndex, style: styles.listItem },
                    React.createElement(
                      Text,
                      { style: styles.bullet },
                      '\u2022'
                    ),
                    React.createElement(
                      Text,
                      { style: styles.listText },
                      ...renderFormattedText(item)
                    )
                  )
                )
              );
            case 'paragraph':
            default:
              return React.createElement(
                Text,
                { key: index, style: styles.paragraph },
                ...renderFormattedText(element.content)
              );
          }
        })
      ),
      // Footer
      React.createElement(
        View,
        { style: styles.footer, fixed: true },
        React.createElement(
          Text,
          null,
          `${storeName} | ${storeAddress} | ${storePhone}`
        )
      )
    )
  );
}

/**
 * Generate PDF buffer from notice content
 */
export async function generateNoticePdf(
  markdownContent: string,
  storeName: string,
  storeAddress: string,
  storePhone: string,
  generatedDate: string
): Promise<Buffer> {
  const document = NoticePdfDocument({
    content: markdownContent,
    storeName,
    storeAddress,
    storePhone,
    generatedDate,
  });

  const buffer = await renderToBuffer(document);
  return Buffer.from(buffer);
}

/**
 * Generate PDF from a notice history record
 */
export async function generateNoticePdfFromHistory(
  noticeId: string
): Promise<Buffer | null> {
  // Import prisma and store settings to avoid circular dependencies
  const { prisma } = await import('@/lib/db/prisma');
  const { StoreSettingsService } = await import('@/lib/services/store-settings.service');

  const [notice, storeSettings] = await Promise.all([
    prisma.noticeHistory.findUnique({
      where: { id: noticeId },
      include: {
        noticeType: true,
      },
    }),
    StoreSettingsService.getSettings(),
  ]);

  if (!notice) {
    return null;
  }

  // Get the original markdown content from variable snapshot
  const variableSnapshot = notice.variableSnapshot as Record<
    string,
    unknown
  > | null;
  const currentDate =
    (variableSnapshot?.currentDate as string) ||
    new Date(notice.generatedAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  // We need to convert the HTML content back to markdown for PDF generation
  // or use the template with variables
  // For now, we'll use a simple approach - store markdown in history
  // This is a limitation - ideally we'd store both markdown and HTML

  // Use the rendered content (HTML) - we'll parse it simply
  // Better approach: store markdown in variableSnapshot
  const markdown =
    (variableSnapshot?.renderedMarkdown as string) ||
    notice.noticeType.template;

  // Format address from parts
  const formattedAddress = [
    storeSettings.street1,
    storeSettings.street2,
    `${storeSettings.city} ${storeSettings.zip}`,
  ]
    .filter(Boolean)
    .join(', ');

  return generateNoticePdf(
    markdown,
    storeSettings.name,
    formattedAddress,
    storeSettings.phone,
    currentDate
  );
}
