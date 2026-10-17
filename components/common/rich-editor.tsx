"use client";

import * as React from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { editorExtensions } from "@/lib/editor/extensions";
import type { PMDoc } from "@/lib/doc/types";
import { FormattingToolbar } from "@/features/editor/formatting-toolbar";
import { cn } from "@/lib/utils";

/**
 * Self-contained rich-text editor used outside the PLR Editor (AI Writer output, rebrand edits, notes).
 * Change `resetKey` to load new content.
 */
export function RichEditor({
  content,
  resetKey,
  onChange,
  placeholder,
  className,
  minHeight = 320,
  toolbar = true,
  editorRef,
  testId,
}: {
  content: PMDoc;
  resetKey: string | number;
  onChange?: (doc: PMDoc) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
  toolbar?: boolean;
  editorRef?: React.MutableRefObject<Editor | null>;
  testId?: string;
}) {
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const editor = useEditor(
    {
      extensions: editorExtensions({ placeholder }),
      content,
      immediatelyRender: false,
      editorProps: { attributes: { class: "plr-doc", style: `min-height:${minHeight}px`, ...(testId ? { "data-testid": testId } : {}) } },
      onUpdate: ({ editor: e }) => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => onChangeRef.current?.(e.getJSON() as PMDoc), 200);
      },
    },
    [resetKey],
  );
  React.useEffect(() => {
    if (editorRef) editorRef.current = editor as Editor | null;
  }, [editor, editorRef]);
  React.useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        if (editor && !editor.isDestroyed) onChangeRef.current?.(editor.getJSON() as PMDoc);
      }
    },
    [editor],
  );
  return (
    <div className={cn("flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card", className)}>
      {toolbar && <FormattingToolbar editor={editor as Editor | null} />}
      <div className="plr-scroll min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
