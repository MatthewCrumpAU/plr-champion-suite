"use client";

import * as React from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { ArrowDown, ArrowUp, CaseSensitive, WholeWord, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/primitives";
import { Tooltip } from "@/components/ui/overlays";
import { getSearchState } from "@/lib/editor/search";
import { cn } from "@/lib/utils";

export function FindBar({
  editor,
  showReplace,
  onClose,
  onReplaceEverywhere,
  chapterLabel,
}: {
  editor: Editor;
  showReplace: boolean;
  onClose: () => void;
  onReplaceEverywhere: (find: string, replace: string, opts: { caseSensitive: boolean; wholeWord: boolean }) => void;
  chapterLabel: string;
}) {
  const [query, setQuery] = React.useState("");
  const [replace, setReplace] = React.useState("");
  const [caseSensitive, setCase] = React.useState(false);
  const [wholeWord, setWhole] = React.useState(false);
  const [replaceOpen, setReplaceOpen] = React.useState(showReplace);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => setReplaceOpen(showReplace), [showReplace]);
  React.useEffect(() => {
    const sel = editor.state.selection;
    if (!sel.empty) {
      const t = editor.state.doc.textBetween(sel.from, sel.to, " ").slice(0, 100);
      if (t && !t.includes("\n")) setQuery(t);
    }
    inputRef.current?.focus();
    inputRef.current?.select();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    editor.commands.setSearch(query, { caseSensitive, wholeWord });
  }, [editor, query, caseSensitive, wholeWord]);

  React.useEffect(() => () => void editor.commands.clearSearch(), [editor]);

  const st = useEditorState({ editor, selector: ({ editor: e }) => {
    const s = e ? getSearchState(e.state) : undefined;
    return { count: s?.matches.length ?? 0, active: s?.active ?? -1 };
  } });

  const count = st?.count ?? 0;
  const active = st?.active ?? -1;

  return (
    <div className="no-print flex flex-wrap items-center gap-2 border-b bg-[#fbfbfd] px-3 py-2" role="search" data-testid="find-bar">
      <div className="flex min-w-[260px] flex-1 items-center gap-1.5">
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Find in this ${chapterLabel.toLowerCase()}`}
          className="h-8"
          aria-label="Find"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              editor.commands.gotoMatch(e.shiftKey ? -1 : 1);
            }
            if (e.key === "Escape") onClose();
          }}
        />
        <span className="w-16 shrink-0 text-center text-xs tabular-nums text-muted-foreground" data-testid="find-count">
          {query ? (count ? `${active + 1} of ${count}` : "No results") : ""}
        </span>
        <Tooltip content="Match case">
          <Button variant="ghost" size="icon-xs" aria-pressed={caseSensitive} className={cn(caseSensitive && "bg-primary-soft text-accent-foreground")} onClick={() => setCase((v) => !v)} aria-label="Match case">
            <CaseSensitive />
          </Button>
        </Tooltip>
        <Tooltip content="Whole words only">
          <Button variant="ghost" size="icon-xs" aria-pressed={wholeWord} className={cn(wholeWord && "bg-primary-soft text-accent-foreground")} onClick={() => setWhole((v) => !v)} aria-label="Whole words">
            <WholeWord />
          </Button>
        </Tooltip>
        <Button variant="ghost" size="icon-xs" onClick={() => editor.commands.gotoMatch(-1)} disabled={!count} aria-label="Previous match">
          <ArrowUp />
        </Button>
        <Button variant="ghost" size="icon-xs" onClick={() => editor.commands.gotoMatch(1)} disabled={!count} aria-label="Next match">
          <ArrowDown />
        </Button>
        {!replaceOpen && (
          <Button variant="ghost" size="xs" onClick={() => setReplaceOpen(true)}>
            Replace…
          </Button>
        )}
      </div>
      {replaceOpen && (
        <div className="flex min-w-[260px] flex-1 flex-wrap items-center gap-1.5">
          <Input value={replace} onChange={(e) => setReplace(e.target.value)} placeholder="Replace with" className="h-8 min-w-40 flex-1" aria-label="Replace with" onKeyDown={(e) => e.key === "Escape" && onClose()} />
          <Button size="xs" variant="outline" disabled={!count} onClick={() => editor.commands.replaceMatch(replace)}>
            Replace
          </Button>
          <Button size="xs" variant="outline" disabled={!count} onClick={() => editor.commands.replaceAllMatches(replace)} data-testid="replace-all-chapter">
            All in {chapterLabel.toLowerCase()}
          </Button>
          <Button size="xs" variant="soft" disabled={!query} onClick={() => onReplaceEverywhere(query, replace, { caseSensitive, wholeWord })} data-testid="replace-everywhere">
            All {chapterLabel.toLowerCase()}s
          </Button>
        </div>
      )}
      <Button variant="ghost" size="icon-xs" onClick={onClose} aria-label="Close find">
        <X />
      </Button>
    </div>
  );
}
