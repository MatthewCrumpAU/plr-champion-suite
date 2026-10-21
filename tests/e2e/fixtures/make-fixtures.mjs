import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import { writeFileSync } from "node:fs";
import { jsPDF } from "jspdf";
// Regenerates the end-to-end fixtures next to this file: node tests/e2e/fixtures/make-fixtures.mjs
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
const out = process.argv[2] || dirname(fileURLToPath(import.meta.url));
const ch = (n, title, paras, bullets) => [
  new Paragraph({ text: `Chapter ${n}: ${title}`, heading: HeadingLevel.HEADING_1 }),
  ...paras.map((p) => new Paragraph({ children: [new TextRun(p)] })),
  ...bullets.map((b) => new Paragraph({ text: b, bullet: { level: 0 } })),
];
const doc = new Document({
  sections: [{
    children: [
      new Paragraph({ text: "Focus Freedom Fast", heading: HeadingLevel.TITLE }),
      ...ch(1, "Why Focus Matters", ["In today's fast-paced world, focus is rare. You should protect two hours each morning for deep work.", "Distraction costs more than most people think."], ["Turn off notifications", "Close your email tab", "Set a 50-minute timer"]),
      ...ch(2, "Plan Your Day", ["Write your top three tasks before you finish work.", "Make sure to block time for the most important task."], ["Review tomorrow's calendar", "Pick one priority", "Prepare your workspace"]),
      ...ch(3, "Finish Strong", ["End the day on purpose. Review what you finished and schedule anything left over."], ["Review your list", "Schedule leftovers", "Close your laptop"]),
    ],
  }],
});
writeFileSync(`${out}/focus-freedom.docx`, await Packer.toBuffer(doc));
writeFileSync(`${out}/licence.txt`, "PRIVATE LABEL RIGHTS LICENSE\n[YES] Can be edited completely and your name put on it as the author.\n[YES] Can be sold as an ebook.\n[NO] Cannot be given away for free.\n[NO] Can NOT sell Master Resell Rights.\n[NO] Cannot be sold on Amazon Kindle.\n");
writeFileSync(`${out}/keywords.csv`, 'Keyword,Avg. monthly searches,Competition,CPC\nfocus tips for remote workers,"1,900",Medium,$1.10\nhome office setup ideas,8100,High,$0.85\n');
// A text-based PDF of the same book: 20pt chapter headings, 11pt body, one chapter per page.
const pdf = new jsPDF({ unit: "pt", format: "a4" });
const chapters = [
  ["Chapter 1: Why Focus Matters", ["In today's fast-paced world, focus is rare. You should protect two hours each morning for deep work.", "Distraction costs more than most people think."]],
  ["Chapter 2: Plan Your Day", ["Write your top three tasks before you finish work.", "Make sure to block time for the most important task."]],
  ["Chapter 3: Finish Strong", ["End the day on purpose. Review what you finished and schedule anything left over."]],
];
chapters.forEach(([title, paras], i) => {
  if (i) pdf.addPage();
  pdf.setFont("helvetica", "bold").setFontSize(20).text(title, 56, 90);
  let y = 130;
  pdf.setFont("helvetica", "normal").setFontSize(11);
  for (const p of paras) {
    const lines = pdf.splitTextToSize(p, 480);
    pdf.text(lines, 56, y);
    y += lines.length * 15 + 12;
  }
});
writeFileSync(`${out}/focus-freedom.pdf`, Buffer.from(pdf.output("arraybuffer")));
console.log("fixtures written");
