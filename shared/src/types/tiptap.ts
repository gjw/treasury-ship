// TipTap/ProseMirror JSON content types
// Used by both web/ (editor, diff viewer) and api/ (Yjs converter, content generators)

export interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface TipTapNode {
  type: string;
  text?: string;
  content?: TipTapNode[];
  marks?: TipTapMark[];
  attrs?: Record<string, unknown>;
}

export interface TipTapDocument {
  type: 'doc';
  content: TipTapNode[];
}
