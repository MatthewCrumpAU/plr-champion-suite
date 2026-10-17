"use client";

import * as React from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Code2,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  MessageSquareQuote,
  Quote,
  Redo2,
  RemoveFormatting,
  Search,
  Strikethrough,
  Table2,
  Underline,
  Undo2,
  Rows3,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/primitives";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Popover, PopoverContent, PopoverTrigger, Tooltip } from "@/components/ui/overlays";
import { CALLOUT_VARIANTS, type CalloutVariant } from "@/lib/editor/nodes";
import { blobToDataUrl } from "@/lib/services/files";
import { cn } from "@/lib/utils";
import { editorInstanceKey } from "@/lib/editor/instance-key";

function TB({ active, label, shortcut, onClick, disabled, children, testId }: { active?: boolean; label: string; shortcut?: string; onClick: () => void; disabled?: boolean; children: React.ReactNode; testId?: string }) {
  return (
    <Tooltip content={label} shortcut={shortcut}>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={label}
        aria-pressed={active}
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        className={cn(active && "bg-primary-soft text-accent-foreground hover:bg-primary-soft")}
        data-testid={testId}
      >
        {children}
      </Button>
    </Tooltip>
  );
}

const Sep = () => <span className="mx-0.5 h-5 w-px shrink-0 bg-border" />;

const BLOCK_STYLES = [
  { id: "p", label: "Paragraph" },
  { id: "h1", label: "Heading 1" },
  { id: "h2", label: "Heading 2" },
  { id: "h3", label: "Heading 3" },
  { id: "h4", label: "Heading 4" },
] as const;

function LinkButton({ editor }: { editor: Editor }) {
  const [open, setOpen] = React.useState(false);
  const [href, setHref] = React.useState("");
  const active = editor.isActive("link");
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setHref((editor.getAttributes("link").href as string) ?? "");
      }}
    >
      <Tooltip content="Link" shortcut="Ctrl+K">
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon-xs" aria-label="Link" data-link-trigger className={cn(active && "bg-primary-soft text-accent-foreground")} onMouseDown={(e) => e.preventDefault()}>
            <Link2 />
          </Button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent align="start" className="w-80">
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = href.trim();
            if (!v) editor.chain().focus().extendMarkRange("link").unsetLink().run();
            else {
              const url = /^(https?:|mailto:)/i.test(v) ? v : `https://${v}`;
              if (editor.state.selection.empty && !active) editor.chain().focus().insertContent({ type: "text", text: v, marks: [{ type: "link", attrs: { href: url } }] }).run();
              else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
            }
            setOpen(false);
          }}
        >
          <label className="text-xs font-medium text-muted-foreground" htmlFor="link-url">
            Link address
          </label>
          <Input id="link-url" value={href} onChange={(e) => setHref(e.target.value)} placeholder="https://example.com" autoFocus />
          <div className="flex justify-end gap-2">
            {active && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  editor.chain().focus().extendMarkRange("link").unsetLink().run();
                  setOpen(false);
                }}
              >
                Remove
              </Button>
            )}
            <Button type="submit" size="sm">
              Apply
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

export function FormattingToolbar(props: { editor: Editor | null; onFind?: () => void; className?: string }) {
  return <FormattingToolbarInner key={editorInstanceKey(props.editor)} {...props} />;
}

function FormattingToolbarInner({ editor, onFind, className }: { editor: Editor | null; onFind?: () => void; className?: string }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return null;
      return {
        bold: e.isActive("bold"),
        italic: e.isActive("italic"),
        underline: e.isActive("underline"),
        strike: e.isActive("strike"),
        highlight: e.isActive("highlight"),
        code: e.isActive("code"),
        bullet: e.isActive("bulletList"),
        ordered: e.isActive("orderedList"),
        task: e.isActive("taskList"),
        quote: e.isActive("blockquote"),
        callout: e.isActive("callout"),
        codeBlock: e.isActive("codeBlock"),
        table: e.isActive("table"),
        h: [1, 2, 3, 4].find((l) => e.isActive("heading", { level: l })) ?? 0,
        align: (["center", "right", "justify"] as const).find((a) => e.isActive({ textAlign: a })) ?? "left",
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
      };
    },
  });
  if (!editor || !s) return <div className={cn("h-11 border-b bg-card", className)} />;

  const chain = () => editor.chain().focus();
  const blockLabel = s.h ? `Heading ${s.h}` : "Paragraph";
  const fileRef = React.createRef<HTMLInputElement>();

  return (
    <div className={cn("no-print flex h-11 shrink-0 items-center gap-0.5 overflow-x-auto border-b bg-card px-2", className)} role="toolbar" aria-label="Formatting">
      <TB label="Undo" shortcut="Ctrl+Z" onClick={() => chain().undo().run()} disabled={!s.canUndo}>
        <Undo2 />
      </TB>
      <TB label="Redo" shortcut="Ctrl+Shift+Z" onClick={() => chain().redo().run()} disabled={!s.canRedo}>
        <Redo2 />
      </TB>
      <Sep />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="xs" className="w-[104px] justify-between font-normal" onMouseDown={(e) => e.preventDefault()} data-testid="block-style">
            {blockLabel} <ChevronDown className="opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-40">
          {BLOCK_STYLES.map((b) => (
            <DropdownMenuItem
              key={b.id}
              onSelect={() => (b.id === "p" ? chain().setParagraph().run() : chain().setHeading({ level: Number(b.id.slice(1)) as 1 | 2 | 3 | 4 }).run())}
              className={cn(b.id === "h1" && "text-lg font-bold", b.id === "h2" && "text-base font-semibold", b.id === "h3" && "font-semibold")}
            >
              {b.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Sep />
      <TB label="Bold" shortcut="Ctrl+B" active={s.bold} onClick={() => chain().toggleBold().run()} testId="fmt-bold">
        <Bold />
      </TB>
      <TB label="Italic" shortcut="Ctrl+I" active={s.italic} onClick={() => chain().toggleItalic().run()}>
        <Italic />
      </TB>
      <TB label="Underline" shortcut="Ctrl+U" active={s.underline} onClick={() => chain().toggleUnderline().run()}>
        <Underline />
      </TB>
      <TB label="Strikethrough" active={s.strike} onClick={() => chain().toggleStrike().run()}>
        <Strikethrough />
      </TB>
      <TB label="Highlight" active={s.highlight} onClick={() => chain().toggleHighlight().run()}>
        <Highlighter />
      </TB>
      <LinkButton editor={editor} />
      <Sep />
      <TB label="Bulleted list" active={s.bullet} onClick={() => chain().toggleBulletList().run()} testId="fmt-bullets">
        <List />
      </TB>
      <TB label="Numbered list" active={s.ordered} onClick={() => chain().toggleOrderedList().run()}>
        <ListOrdered />
      </TB>
      <TB label="Checklist" active={s.task} onClick={() => chain().toggleTaskList().run()}>
        <ListChecks />
      </TB>
      <TB label="Quote" active={s.quote} onClick={() => chain().toggleBlockquote().run()}>
        <Quote />
      </TB>
      <DropdownMenu>
        <Tooltip content="Callout box">
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" aria-label="Callout box" className={cn(s.callout && "bg-primary-soft text-accent-foreground")} onMouseDown={(e) => e.preventDefault()}>
              <MessageSquareQuote />
            </Button>
          </DropdownMenuTrigger>
        </Tooltip>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Callout</DropdownMenuLabel>
          {CALLOUT_VARIANTS.map((v) => (
            <DropdownMenuItem key={v} onSelect={() => (s.callout ? chain().updateAttributes("callout", { variant: v }).run() : chain().setCallout(v as CalloutVariant).run())}>
              <span className="capitalize">{v}</span>
            </DropdownMenuItem>
          ))}
          {s.callout && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => chain().unsetCallout().run()}>Remove callout</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <TB label="Code block" active={s.codeBlock} onClick={() => chain().toggleCodeBlock().run()}>
        <Code2 />
      </TB>
      <Sep />
      <TB label="Align left" active={s.align === "left"} onClick={() => chain().setTextAlign("left").run()}>
        <AlignLeft />
      </TB>
      <TB label="Align centre" active={s.align === "center"} onClick={() => chain().setTextAlign("center").run()}>
        <AlignCenter />
      </TB>
      <TB label="Align right" active={s.align === "right"} onClick={() => chain().setTextAlign("right").run()}>
        <AlignRight />
      </TB>
      <TB label="Justify" active={s.align === "justify"} onClick={() => chain().setTextAlign("justify").run()}>
        <AlignJustify />
      </TB>
      <Sep />
      <DropdownMenu>
        <Tooltip content="Table">
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" aria-label="Table" className={cn(s.table && "bg-primary-soft text-accent-foreground")} onMouseDown={(e) => e.preventDefault()} data-testid="fmt-table">
              <Table2 />
            </Button>
          </DropdownMenuTrigger>
        </Tooltip>
        <DropdownMenuContent align="start" className="min-w-52">
          <DropdownMenuItem onSelect={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>Insert 3 × 3 table</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => chain().insertTable({ rows: 4, cols: 2, withHeaderRow: true }).run()}>Insert 4 × 2 table</DropdownMenuItem>
          {s.table && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => chain().addRowAfter().run()}>Add row below</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => chain().addRowBefore().run()}>Add row above</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => chain().addColumnAfter().run()}>Add column right</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => chain().addColumnBefore().run()}>Add column left</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => chain().toggleHeaderRow().run()}>Toggle header row</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => chain().mergeOrSplit().run()}>Merge / split cells</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => chain().deleteRow().run()}>Delete row</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => chain().deleteColumn().run()}>Delete column</DropdownMenuItem>
              <DropdownMenuItem destructive onSelect={() => chain().deleteTable().run()}>
                Delete table
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <TB label="Insert image" onClick={() => fileRef.current?.click()}>
        <ImagePlus />
      </TB>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          if (f.size > 3 * 1024 * 1024) return toast.error("Images in documents are limited to 3 MB. Resize it and try again.");
          const src = await blobToDataUrl(f);
          chain().setImage({ src, alt: f.name.replace(/\.[^.]+$/, "") }).run();
        }}
      />
      <TB label="Answer lines (workbooks)" onClick={() => chain().insertWritingLines(3).run()}>
        <Rows3 />
      </TB>
      <TB label="Divider" onClick={() => chain().setHorizontalRule().run()}>
        <Minus />
      </TB>
      <TB label="Clear formatting" onClick={() => chain().unsetAllMarks().clearNodes().run()}>
        <RemoveFormatting />
      </TB>
      {onFind && (
        <>
          <Sep />
          <TB label="Find & replace" shortcut="Ctrl+F" onClick={onFind} testId="open-find">
            <Search />
          </TB>
        </>
      )}
    </div>
  );
}
