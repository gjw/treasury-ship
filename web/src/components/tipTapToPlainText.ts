import type { TipTapNode } from '@ship/shared';

/**
 * Helper function to convert TipTap JSON content to plain text for diffing.
 * Recursively extracts text content from the TipTap document structure.
 */
function isTipTapNode(value: unknown): value is TipTapNode {
  return typeof value === 'object' && value !== null && 'type' in value && typeof (value as { type: unknown }).type === 'string';
}

export function tipTapToPlainText(content: TipTapNode | Record<string, unknown> | null | undefined): string {
  if (!content || !isTipTapNode(content)) return '';

  const extractText = (node: TipTapNode): string => {
    // Handle text nodes
    if (node.type === 'text' && node.text) {
      return node.text;
    }

    // Handle paragraph nodes - add newline after
    if (node.type === 'paragraph') {
      const childContent = node.content
        ? node.content.map((child) => extractText(child)).join('')
        : '';
      return childContent + '\n';
    }

    // Handle heading nodes - add newline after
    if (node.type === 'heading') {
      const childContent = node.content
        ? node.content.map((child) => extractText(child)).join('')
        : '';
      return childContent + '\n';
    }

    // Handle bulletList and orderedList
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      const items = node.content
        ? node.content.map((child) => extractText(child)).join('')
        : '';
      return items;
    }

    // Handle listItem
    if (node.type === 'listItem') {
      const childContent = node.content
        ? node.content.map((child) => extractText(child)).join('')
        : '';
      return '• ' + childContent;
    }

    // Handle blockquote
    if (node.type === 'blockquote') {
      const childContent = node.content
        ? node.content.map((child) => extractText(child)).join('')
        : '';
      return '> ' + childContent;
    }

    // Handle codeBlock
    if (node.type === 'codeBlock') {
      const childContent = node.content
        ? node.content.map((child) => extractText(child)).join('')
        : '';
      return '```\n' + childContent + '```\n';
    }

    // Handle hardBreak
    if (node.type === 'hardBreak') {
      return '\n';
    }

    // Handle any node with content (including doc)
    if (node.content) {
      return node.content.map((child) => extractText(child)).join('');
    }

    return '';
  };

  return extractText(content).trim();
}
