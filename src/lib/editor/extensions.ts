import type { AnyExtension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { Callout, WritingLines } from "./nodes";

/**
 * Schema extensions shared by the editor and by import/AI conversion (generateJSON),
 * so everything that enters a document fits the same schema.
 */
export function schemaExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
      link: { openOnClick: false, autolink: true, linkOnPaste: true, HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" }, protocols: ["http", "https", "mailto"] },
      undoRedo: { depth: 200 },
    }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Highlight,
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({ table: { resizable: true, HTMLAttributes: { class: "plr-table" } } }),
    Image.configure({ allowBase64: true, inline: false }),
    Callout,
    WritingLines,
  ];
}

export function editorExtensions(opts: { placeholder?: string } = {}): AnyExtension[] {
  return [
    ...schemaExtensions(),
    Placeholder.configure({ placeholder: opts.placeholder ?? "Start writing, paste content, or import a document…" }),
    CharacterCount,
  ];
}
