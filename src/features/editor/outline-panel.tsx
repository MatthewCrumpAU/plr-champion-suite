"use client";

import * as React from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import type { Chapter } from "@/lib/models/document";
import { docHeadings } from "@/lib/doc/text";
import { cn } from "@/lib/utils";
import { editorInstanceKey } from "@/lib/editor/instance-key";

type OutlineProps = { editor: Editor | null; chapters: Chapter[]; activeId: string | null; onSelectChapter: (id: string) => void; label: string };

export function OutlinePanel(props: OutlineProps) {
  return <OutlineInner key={editorInstanceKey(props.editor)} {...props} />;
}

function OutlineInner({ editor, chapters, activeId, onSelectChapter, label }: OutlineProps) {
  const headings = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return [] as { level: number; text: string; pos: number }[];
      const out: { level: number; text: string; pos: number }[] = [];
      e.state.doc.descendants((node, pos) => {
        if (node.type.name === "heading") {
          out.push({ level: Number(node.attrs.level ?? 1), text: node.textContent, pos });
          return false;
        }
        return node.type.name === "doc";
      });
      return out;
    },
  });

  const jump = (pos: number) => {
    if (!editor) return;
    editor.chain().focus().setTextSelection(pos + 1).run();
    const dom = editor.view.nodeDOM(pos) as HTMLElement | null;
    dom?.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  return (
    <div className="grid gap-4">
      <div>
        <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">This {label.toLowerCase()}</p>
        {headings?.length ? (
          <ul className="grid gap-0.5">
            {headings.map((h, i) => (
              <li key={`${h.pos}-${i}`}>
                <button type="button" onClick={() => jump(h.pos)} className="w-full truncate rounded-md px-2 py-1 text-left text-[13px] hover:bg-secondary" style={{ paddingLeft: 8 + (h.level - 1) * 12 }}>
                  <span className={cn(h.level <= 2 ? "font-medium" : "text-muted-foreground")}>{h.text || "Untitled heading"}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-2 text-xs text-muted-foreground">No headings yet. Use Heading 2/3 from the toolbar to structure this {label.toLowerCase()}.</p>
        )}
      </div>
      <div>
        <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Whole document</p>
        <ul className="grid gap-1">
          {chapters.map((c, i) => {
            const hs = docHeadings(c.content).filter((h) => h.level <= 2);
            return (
              <li key={c.id}>
                <button type="button" onClick={() => onSelectChapter(c.id)} className={cn("w-full truncate rounded-md px-2 py-1 text-left text-[13px] font-medium hover:bg-secondary", c.id === activeId && "text-primary")}>
                  {i + 1}. {c.title}
                </button>
                {hs.length > 0 && (
                  <ul className="ml-6 border-l pl-2">
                    {hs.slice(0, 12).map((h, j) => (
                      <li key={j} className="truncate py-0.5 text-[12px] text-muted-foreground">
                        {h.text}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
