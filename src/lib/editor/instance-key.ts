import type { Editor } from "@tiptap/react";

const ids = new WeakMap<object, number>();
let next = 1;

/**
 * Stable key per editor instance. Components that call `useEditorState` are keyed with it so they
 * re-subscribe immediately when a new editor instance appears (TipTap only notifies on the next transaction).
 */
export function editorInstanceKey(editor: Editor | null | undefined): string {
  if (!editor) return "none";
  let id = ids.get(editor);
  if (!id) {
    id = next++;
    ids.set(editor, id);
  }
  return `ed-${id}`;
}
