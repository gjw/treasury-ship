import { useMemo } from 'react';
import DiffMatchPatch from 'diff-match-patch';

interface DiffViewerProps {
  oldContent: string;
  newContent: string;
  className?: string;
}

/**
 * DiffViewer component - displays inline text diff with visual highlighting
 *
 * Deletions are shown with strikethrough and red background.
 * Additions are shown with green background.
 * Unchanged text renders normally.
 */
export function DiffViewer({ oldContent, newContent, className = '' }: DiffViewerProps) {
  const diffs = useMemo(() => {
    const dmp = new DiffMatchPatch();
    const diff = dmp.diff_main(oldContent, newContent);
    dmp.diff_cleanupSemantic(diff);
    return diff;
  }, [oldContent, newContent]);

  return (
    <div className={`font-mono text-sm whitespace-pre-wrap ${className}`}>
      {diffs.map((part, index) => {
        const [operation, text] = part;

        if (operation === -1) {
          // Deletion - strikethrough with red background
          return (
            <span
              key={index}
              className="line-through bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
            >
              {text}
            </span>
          );
        }

        if (operation === 1) {
          // Addition - green background
          return (
            <span
              key={index}
              className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
            >
              {text}
            </span>
          );
        }

        // Unchanged text - operation === 0
        return <span key={index}>{text}</span>;
      })}
    </div>
  );
}

// Re-export for backwards compatibility
export { tipTapToPlainText } from '@/components/tipTapToPlainText';

export default DiffViewer;
