/**
 * A chapter's title without a leading "Chapter 3:" (or Part, Module, Lesson, Section, Step, Day, Week,
 * Unit) where the number is already shown next to it: "Chapter 3: Finish Strong" → "Finish Strong".
 */
export function shortTitle(title: string): string {
  const t = title.trim();
  const rest = t.replace(/^(chapter|part|module|lesson|section|step|day|week|unit)\s+([0-9]+|[ivxlc]+)\s*[:.\-–—]\s*/i, "");
  return rest || t || "Untitled";
}
