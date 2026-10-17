"use client";

import * as React from "react";
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, CheckCircle2, Copy, GripVertical, Merge, MoreHorizontal, Pencil, Plus, Scissors, Trash2, Circle } from "lucide-react";
import type { Chapter } from "@/lib/models/document";
import { docWords } from "@/lib/doc/text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/primitives";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Tooltip } from "@/components/ui/overlays";
import { useConfirm } from "@/components/ui/confirm";
import { cn } from "@/lib/utils";

export interface ChapterActions {
  onSelect: (id: string) => void;
  onAdd: (afterId: string | null) => void;
  onRename: (id: string, title: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (fromId: string, toId: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onMergeNext: (id: string) => void;
  onSplit: (id: string) => void;
  onToggleApproved: (id: string) => void;
}

function Row({ chapter, index, total, active, label, actions }: { chapter: Chapter; index: number; total: number; active: boolean; label: string; actions: ChapterActions }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: chapter.id });
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(chapter.title);
  const confirm = useConfirm();
  const words = React.useMemo(() => docWords(chapter.content), [chapter.content]);

  React.useEffect(() => setValue(chapter.title), [chapter.title]);

  const commit = () => {
    setEditing(false);
    const t = value.trim();
    if (t && t !== chapter.title) actions.onRename(chapter.id, t);
    else setValue(chapter.title);
  };

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group relative flex min-w-0 items-center gap-1 rounded-lg pr-1 transition-colors", active ? "bg-primary-soft" : "hover:bg-secondary", isDragging && "z-10 bg-card shadow-lg ring-1 ring-border")}
      data-testid="chapter-row"
    >
      <button type="button" className="flex h-9 w-5 shrink-0 cursor-grab items-center justify-center text-muted-foreground/60 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing" aria-label={`Drag to reorder ${chapter.title}`} {...attributes} {...listeners}>
        <GripVertical className="size-3.5" />
      </button>
      {editing ? (
        <Input
          value={value}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setValue(chapter.title);
              setEditing(false);
            }
          }}
          className="h-7 flex-1 text-[13px]"
          aria-label={`${label} title`}
        />
      ) : (
        <button type="button" onClick={() => actions.onSelect(chapter.id)} onDoubleClick={() => setEditing(true)} className="flex min-w-0 flex-1 items-start gap-2 py-1.5 text-left">
          <span className={cn("mt-px w-5 shrink-0 text-right text-[11px] tabular-nums", active ? "text-primary" : "text-muted-foreground")}>{index + 1}</span>
          <span className="min-w-0 flex-1">
            <span className={cn("block truncate text-[13px] leading-snug", active ? "font-semibold text-foreground" : "font-medium")}>{chapter.title || "Untitled"}</span>
            <span className="block text-[11px] text-muted-foreground">{words.toLocaleString()} words</span>
          </span>
        </button>
      )}
      <Tooltip content={chapter.approved ? "Approved — click to unmark" : "Mark as approved"}>
        <button type="button" onClick={() => actions.onToggleApproved(chapter.id)} className={cn("flex size-6 shrink-0 items-center justify-center rounded", chapter.approved ? "text-success" : "text-muted-foreground/40 opacity-0 group-hover:opacity-100")} aria-label={chapter.approved ? "Unmark approved" : "Mark approved"}>
          {chapter.approved ? <CheckCircle2 className="size-4" /> : <Circle className="size-4" />}
        </button>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-xs" className="size-6 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100" aria-label={`${chapter.title} options`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <Pencil /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => actions.onAdd(chapter.id)}>
            <Plus /> Add {label.toLowerCase()} below
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => actions.onDuplicate(chapter.id)}>
            <Copy /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={index === 0} onSelect={() => actions.onMove(chapter.id, -1)}>
            <ArrowUp /> Move up
          </DropdownMenuItem>
          <DropdownMenuItem disabled={index === total - 1} onSelect={() => actions.onMove(chapter.id, 1)}>
            <ArrowDown /> Move down
          </DropdownMenuItem>
          <DropdownMenuItem disabled={index === total - 1} onSelect={() => actions.onMergeNext(chapter.id)}>
            <Merge /> Merge with next
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              actions.onSelect(chapter.id);
              actions.onSplit(chapter.id);
            }}
            disabled={!active}
          >
            <Scissors /> Split at cursor
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            destructive
            disabled={total <= 1}
            onSelect={async () => {
              const ok = await confirm({ title: `Delete “${chapter.title}”?`, description: `The ${label.toLowerCase()} is removed from this document. You can get it back from Version history.`, confirmLabel: "Delete", destructive: true });
              if (ok) actions.onDelete(chapter.id);
            }}
          >
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

export function ChapterList({ chapters, activeId, label, actions }: { chapters: Chapter[]; activeId: string | null; label: string; actions: ChapterActions }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = (e: DragEndEvent) => {
    if (e.over && e.active.id !== e.over.id) actions.onReorder(String(e.active.id), String(e.over.id));
  };
  const approved = chapters.filter((c) => c.approved).length;
  return (
    <div className="grid min-w-0 grid-cols-1 gap-2">
      <div className="flex items-center justify-between px-1">
        <p className="text-[11px] font-medium text-muted-foreground">
          {chapters.length} {label.toLowerCase()}
          {chapters.length === 1 ? "" : "s"} · {approved} approved
        </p>
        <Button variant="ghost" size="xs" onClick={() => actions.onAdd(activeId)} data-testid="add-chapter">
          <Plus /> Add
        </Button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={chapters.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <ul className="grid min-w-0 grid-cols-1 gap-0.5">
            {chapters.map((c, i) => (
              <Row key={c.id} chapter={c} index={i} total={chapters.length} active={c.id === activeId} label={label} actions={actions} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}
