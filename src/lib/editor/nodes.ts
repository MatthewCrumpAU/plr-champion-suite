import { Node, mergeAttributes } from "@tiptap/core";

export const CALLOUT_VARIANTS = ["tip", "note", "warning", "example", "summary", "exercise"] as const;
export type CalloutVariant = (typeof CALLOUT_VARIANTS)[number];
const LABELS: Record<CalloutVariant, string> = { tip: "Tip", note: "Note", warning: "Warning", example: "Example", summary: "Summary", exercise: "Exercise" };

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (variant: CalloutVariant) => ReturnType;
      toggleCallout: (variant: CalloutVariant) => ReturnType;
      unsetCallout: () => ReturnType;
    };
    writingLines: {
      insertWritingLines: (count?: number) => ReturnType;
    };
  }
}

/** Highlighted box (tip, note, warning…) used heavily in ebooks and workbooks. */
export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return {
      variant: {
        default: "note",
        parseHTML: (el) => (CALLOUT_VARIANTS as readonly string[]).includes(el.getAttribute("data-variant") ?? "") ? el.getAttribute("data-variant") : "note",
        renderHTML: (attrs) => ({ "data-variant": attrs.variant, "data-label": LABELS[(attrs.variant as CalloutVariant) ?? "note"] ?? "Note" }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-callout]" }, { tag: "div.plr-callout" }, { tag: "aside" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { class: "plr-callout", "data-callout": "" }), 0];
  },
  addCommands() {
    return {
      setCallout:
        (variant) =>
        ({ commands }) =>
          commands.wrapIn(this.name, { variant }),
      toggleCallout:
        (variant) =>
        ({ commands, editor }) =>
          editor.isActive(this.name) ? commands.lift(this.name) : commands.wrapIn(this.name, { variant }),
      unsetCallout:
        () =>
        ({ commands }) =>
          commands.lift(this.name),
    };
  },
});

/** Ruled answer lines for workbooks and worksheets. */
export const WritingLines = Node.create({
  name: "writingLines",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      count: {
        default: 3,
        parseHTML: (el) => Math.min(20, Math.max(1, Number(el.getAttribute("data-count") ?? 3))),
        renderHTML: (attrs) => ({ "data-count": attrs.count }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-writing-lines]" }];
  },
  renderHTML({ HTMLAttributes, node }) {
    const count = Math.min(20, Math.max(1, Number(node.attrs.count ?? 3)));
    return ["div", mergeAttributes(HTMLAttributes, { class: "plr-writing-lines", "data-writing-lines": "" }), ...Array.from({ length: count }, () => ["span", {}] as const)];
  },
  addCommands() {
    return {
      insertWritingLines:
        (count = 3) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { count } }),
    };
  },
});
