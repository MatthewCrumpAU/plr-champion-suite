import type { PMMark, PMNode } from "./types";

/** TipTap JSON → Markdown (GitHub-flavoured). Pure function, no DOM. */

function escapeMd(text: string): string {
  return text.replace(/([\\`*_[\]#|<>])/g, "\\$1");
}

function inlineMd(nodes: PMNode[] | undefined): string {
  if (!nodes) return "";
  return nodes
    .map((n) => {
      if (n.type === "hardBreak") return "  \n";
      if (n.type === "image") return `![${n.attrs?.alt ?? ""}](${n.attrs?.src ?? ""})`;
      if (n.type !== "text") return inlineMd(n.content);
      let t = escapeMd(n.text ?? "");
      const marks: PMMark[] = n.marks ?? [];
      const has = (type: string) => marks.some((m) => m.type === type);
      if (has("code")) t = "`" + (n.text ?? "").replace(/`/g, "\\`") + "`";
      if (has("bold")) t = `**${t}**`;
      if (has("italic")) t = `*${t}*`;
      if (has("strike")) t = `~~${t}~~`;
      if (has("highlight")) t = `==${t}==`;
      const link = marks.find((m) => m.type === "link");
      if (link?.attrs?.href) t = `[${t}](${String(link.attrs.href)})`;
      return t;
    })
    .join("");
}

function indent(text: string, prefix: string): string {
  return text
    .split("\n")
    .map((l, i) => (i === 0 ? l : l ? prefix + l : l))
    .join("\n");
}

function listItems(node: PMNode, ordered: boolean, start = 1, task = false): string {
  return (node.content ?? [])
    .map((li, i) => {
      const marker = task ? `- [${li.attrs?.checked ? "x" : " "}] ` : ordered ? `${start + i}. ` : "- ";
      const body = (li.content ?? []).map((c) => blockMd(c)).join("\n").trim();
      return marker + indent(body, " ".repeat(marker.length));
    })
    .join("\n");
}

function tableMd(node: PMNode): string {
  const rows = (node.content ?? []).map((r) => (r.content ?? []).map((c) => inlineMd((c.content ?? []).flatMap((p) => p.content ?? [])).replace(/\|/g, "\\|").replace(/\n/g, " ")));
  if (!rows.length) return "";
  const width = Math.max(...rows.map((r) => r.length));
  const pad = (r: string[]) => [...r, ...Array(width - r.length).fill("")];
  const header = pad(rows[0]);
  const lines = [`| ${header.join(" | ")} |`, `| ${header.map(() => "---").join(" | ")} |`, ...rows.slice(1).map((r) => `| ${pad(r).join(" | ")} |`)];
  return lines.join("\n");
}

function blockMd(node: PMNode): string {
  switch (node.type) {
    case "paragraph":
      return inlineMd(node.content);
    case "heading":
      return `${"#".repeat(Math.min(6, Number(node.attrs?.level ?? 2)))} ${inlineMd(node.content)}`;
    case "bulletList":
      return listItems(node, false);
    case "orderedList":
      return listItems(node, true, Number(node.attrs?.start ?? 1));
    case "taskList":
      return listItems(node, false, 1, true);
    case "blockquote":
      return (node.content ?? [])
        .map(blockMd)
        .join("\n\n")
        .split("\n")
        .map((l) => `> ${l}`)
        .join("\n");
    case "callout": {
      const label = String(node.attrs?.variant ?? "note").toUpperCase();
      const body = (node.content ?? []).map(blockMd).join("\n\n");
      return `> **${label}:** ${body.split("\n").join("\n> ")}`;
    }
    case "codeBlock":
      return "```\n" + (node.content ?? []).map((c) => c.text ?? "").join("") + "\n```";
    case "horizontalRule":
      return "---";
    case "table":
      return tableMd(node);
    case "image":
      return `![${node.attrs?.alt ?? ""}](${node.attrs?.src ?? ""})`;
    case "writingLines":
      return Array.from({ length: Number(node.attrs?.count ?? 3) }, () => "______________________________").join("\n\n");
    default:
      return (node.content ?? []).map(blockMd).join("\n\n");
  }
}

export function docToMarkdown(doc: PMNode | null | undefined): string {
  if (!doc) return "";
  return (doc.content ?? [])
    .map(blockMd)
    .filter((s) => s.trim() !== "")
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Plain text export (keeps list markers and headings readable). */
export function docToPlainText(doc: PMNode | null | undefined): string {
  return docToMarkdown(doc)
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/==([^=]+)==/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/\\([\\`*_[\]#|<>])/g, "$1");
}
