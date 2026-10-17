import { uid } from "@/lib/utils";
import { linear, solid, type ColorRole, type CoverCategory, type CoverData, type CoverElement, type CoverImageElement, type CoverLineElement, type CoverShapeElement, type CoverTextElement, type Fill } from "@/lib/models/design";

export interface Palette {
  primary: string;
  secondary: string;
  accent: string;
  dark: string;
  light: string;
}

export interface TemplateText {
  title: string;
  subtitle: string;
  author: string;
  tagline: string;
  brand: string;
}

export interface TemplateContext {
  w: number;
  h: number;
  p: Palette;
  heading: string;
  body: string;
  t: TemplateText;
}

export interface CoverTemplate {
  id: string;
  name: string;
  category: CoverCategory;
  size: { w: number; h: number };
  palette: Palette;
  heading: string;
  body: string;
  build: (c: TemplateContext) => { background: Fill; elements: CoverElement[] };
}

export const COVER_SIZES: { id: string; label: string; category: CoverCategory; w: number; h: number }[] = [
  { id: "ebook", label: "Ebook (1600 × 2560)", category: "ebook", w: 1600, h: 2560 },
  { id: "report", label: "Report — US Letter (1700 × 2200)", category: "report", w: 1700, h: 2200 },
  { id: "workbook", label: "Workbook — A4 (1654 × 2339)", category: "workbook", w: 1654, h: 2339 },
  { id: "course", label: "Course banner 16:9 (1920 × 1080)", category: "course", w: 1920, h: 1080 },
  { id: "lead-magnet", label: "Lead magnet 4:5 (1080 × 1350)", category: "lead-magnet", w: 1080, h: 1350 },
  { id: "square", label: "Square (1080 × 1080)", category: "custom", w: 1080, h: 1080 },
  { id: "kindle", label: "Kindle (1600 × 2400)", category: "ebook", w: 1600, h: 2400 },
];

/* ------------------------------ builders ------------------------------ */
const base = (name: string, x: number, y: number) => ({ id: uid("el"), name, x, y, rotation: 0, opacity: 1, visible: true, locked: false });

export function textEl(name: string, x: number, y: number, width: number, text: string, o: Partial<CoverTextElement> = {}): CoverTextElement {
  return {
    ...base(name, x, y),
    type: "text",
    text,
    fontFamily: "inter",
    fontSize: 80,
    fontWeight: 700,
    italic: false,
    fill: "#ffffff",
    align: "center",
    width,
    lineHeight: 1.1,
    letterSpacing: 0,
    uppercase: false,
    stroke: null,
    strokeWidth: 0,
    shadow: null,
    bind: null,
    fontRole: "heading",
    colorRole: null,
    ...o,
  };
}

export function rectEl(name: string, x: number, y: number, width: number, height: number, fill: Fill, o: Partial<CoverShapeElement> = {}): CoverShapeElement {
  return { ...base(name, x, y), type: "rect", width, height, fill, cornerRadius: 0, stroke: null, strokeWidth: 0, colorRole: null, ...o };
}

export function ellipseEl(name: string, x: number, y: number, width: number, height: number, fill: Fill, o: Partial<CoverShapeElement> = {}): CoverShapeElement {
  return { ...base(name, x, y), type: "ellipse", width, height, fill, cornerRadius: 0, stroke: null, strokeWidth: 0, colorRole: null, ...o };
}

export function lineEl(name: string, x: number, y: number, width: number, stroke: string, strokeWidth: number, o: Partial<CoverLineElement> = {}): CoverLineElement {
  return { ...base(name, x, y), type: "line", width, stroke, strokeWidth, dash: false, colorRole: null, ...o };
}

export function imageEl(name: string, x: number, y: number, width: number, height: number, o: Partial<CoverImageElement> = {}): CoverImageElement {
  return { ...base(name, x, y), type: "image", fileId: null, width, height, source: "file", cornerRadius: 0, ...o };
}

const stop = (offset: number, color: string, role?: ColorRole) => ({ offset, color, ...(role ? { role } : {}) });
const lin = (angle: number, a: [string, ColorRole], b: [string, ColorRole]): Fill => ({ kind: "linear", angle, stops: [stop(0, a[0], a[1]), stop(1, b[0], b[1])] });
const sol = (c: string, role: ColorRole): Fill => solid(c, role);

/* ------------------------------ templates ----------------------------- */
const EBOOK = { w: 1600, h: 2560 };
const REPORT = { w: 1700, h: 2200 };
const WORKBOOK = { w: 1654, h: 2339 };
const COURSE = { w: 1920, h: 1080 };
const LEAD = { w: 1080, h: 1350 };

export const COVER_TEMPLATES: CoverTemplate[] = [
  {
    id: "bold-gradient",
    name: "Bold Gradient",
    category: "ebook",
    size: EBOOK,
    palette: { primary: "#4338ca", secondary: "#1e1b4b", accent: "#f5b544", dark: "#0f1222", light: "#ffffff" },
    heading: "montserrat",
    body: "inter",
    build: ({ w, h, p, heading, body, t }) => ({
      background: lin(160, [p.primary, "primary"], [p.secondary, "secondary"]),
      elements: [
        ellipseEl("Glow", w * 0.45, -h * 0.08, w * 0.9, w * 0.9, sol(p.accent, "accent"), { opacity: 0.12, colorRole: "accent" }),
        textEl("Eyebrow", w * 0.1, h * 0.14, w * 0.8, t.tagline || "THE COMPLETE GUIDE", { fontFamily: body, fontSize: 52, fontWeight: 600, letterSpacing: 8, uppercase: true, fill: p.accent, colorRole: "accent", fontRole: "body", bind: "tagline" }),
        textEl("Title", w * 0.08, h * 0.22, w * 0.84, t.title, { fontFamily: heading, fontSize: 168, fontWeight: 900, uppercase: true, lineHeight: 1.02, fill: p.light, colorRole: "light", bind: "title" }),
        rectEl("Accent bar", w * 0.42, h * 0.56, w * 0.16, 14, sol(p.accent, "accent"), { cornerRadius: 7, colorRole: "accent" }),
        textEl("Subtitle", w * 0.12, h * 0.6, w * 0.76, t.subtitle, { fontFamily: body, fontSize: 64, fontWeight: 500, lineHeight: 1.3, fill: p.light, opacity: 0.9, colorRole: "light", fontRole: "body", bind: "subtitle" }),
        textEl("Author", w * 0.1, h * 0.88, w * 0.8, t.author, { fontFamily: body, fontSize: 56, fontWeight: 600, letterSpacing: 4, uppercase: true, fill: p.light, opacity: 0.85, colorRole: "light", fontRole: "body", bind: "author" }),
      ],
    }),
  },
  {
    id: "classic-serif",
    name: "Classic Serif",
    category: "ebook",
    size: EBOOK,
    palette: { primary: "#14302b", secondary: "#2f6f62", accent: "#e9b949", dark: "#0b1a17", light: "#f7f3ea" },
    heading: "playfair",
    body: "lora",
    build: ({ w, h, p, heading, body, t }) => ({
      background: sol(p.primary, "primary"),
      elements: [
        rectEl("Frame", w * 0.06, h * 0.04, w * 0.88, h * 0.92, solid("rgba(0,0,0,0)"), { stroke: p.accent, strokeWidth: 6, colorRole: null }),
        rectEl("Inner frame", w * 0.08, h * 0.052, w * 0.84, h * 0.896, solid("rgba(0,0,0,0)"), { stroke: p.accent, strokeWidth: 2, opacity: 0.6 }),
        textEl("Title", w * 0.12, h * 0.26, w * 0.76, t.title, { fontFamily: heading, fontSize: 176, fontWeight: 700, lineHeight: 1.08, fill: p.light, colorRole: "light", bind: "title" }),
        lineEl("Rule", w * 0.4, h * 0.6, w * 0.2, p.accent, 6, { colorRole: "accent" }),
        textEl("Subtitle", w * 0.14, h * 0.63, w * 0.72, t.subtitle, { fontFamily: body, fontSize: 60, fontWeight: 400, italic: true, lineHeight: 1.35, fill: p.light, opacity: 0.88, colorRole: "light", fontRole: "body", bind: "subtitle" }),
        textEl("Author", w * 0.12, h * 0.86, w * 0.76, t.author, { fontFamily: body, fontSize: 54, fontWeight: 600, letterSpacing: 6, uppercase: true, fill: p.accent, colorRole: "accent", fontRole: "body", bind: "author" }),
      ],
    }),
  },
  {
    id: "minimal-light",
    name: "Minimal Light",
    category: "ebook",
    size: EBOOK,
    palette: { primary: "#5b4df5", secondary: "#c7d2fe", accent: "#f97316", dark: "#111827", light: "#f8fafc" },
    heading: "dm-serif",
    body: "inter",
    build: ({ w, h, p, heading, body, t }) => ({
      background: sol(p.light, "light"),
      elements: [
        ellipseEl("Circle", w * 0.52, h * 0.06, w * 0.62, w * 0.62, sol(p.secondary, "secondary"), { colorRole: "secondary" }),
        ellipseEl("Dot", w * 0.62, h * 0.24, w * 0.16, w * 0.16, sol(p.accent, "accent"), { colorRole: "accent" }),
        textEl("Title", w * 0.09, h * 0.42, w * 0.82, t.title, { fontFamily: heading, fontSize: 190, fontWeight: 400, align: "left", lineHeight: 1.0, fill: p.dark, colorRole: "dark", bind: "title" }),
        rectEl("Bar", w * 0.09, h * 0.73, 140, 16, sol(p.primary, "primary"), { cornerRadius: 8, colorRole: "primary" }),
        textEl("Subtitle", w * 0.09, h * 0.76, w * 0.78, t.subtitle, { fontFamily: body, fontSize: 60, fontWeight: 400, align: "left", lineHeight: 1.35, fill: p.dark, opacity: 0.75, colorRole: "dark", fontRole: "body", bind: "subtitle" }),
        textEl("Author", w * 0.09, h * 0.92, w * 0.82, t.author, { fontFamily: body, fontSize: 50, fontWeight: 700, align: "left", letterSpacing: 3, uppercase: true, fill: p.primary, colorRole: "primary", fontRole: "body", bind: "author" }),
      ],
    }),
  },
  {
    id: "split-block",
    name: "Split Block",
    category: "ebook",
    size: EBOOK,
    palette: { primary: "#0f766e", secondary: "#134e4a", accent: "#fbbf24", dark: "#0b1f1d", light: "#fffbeb" },
    heading: "oswald",
    body: "nunito",
    build: ({ w, h, p, heading, body, t }) => ({
      background: sol(p.light, "light"),
      elements: [
        rectEl("Top block", 0, 0, w, h * 0.62, lin(170, [p.primary, "primary"], [p.secondary, "secondary"])),
        textEl("Eyebrow", w * 0.1, h * 0.1, w * 0.8, t.tagline || "A PRACTICAL GUIDE", { fontFamily: body, fontSize: 50, fontWeight: 700, letterSpacing: 10, uppercase: true, fill: p.accent, colorRole: "accent", fontRole: "body", bind: "tagline" }),
        textEl("Title", w * 0.08, h * 0.2, w * 0.84, t.title, { fontFamily: heading, fontSize: 200, fontWeight: 700, uppercase: true, lineHeight: 1.0, fill: p.light, colorRole: "light", bind: "title" }),
        textEl("Subtitle", w * 0.1, h * 0.67, w * 0.8, t.subtitle, { fontFamily: body, fontSize: 64, fontWeight: 400, lineHeight: 1.3, fill: p.dark, colorRole: "dark", fontRole: "body", bind: "subtitle" }),
        rectEl("Author pill", w * 0.25, h * 0.86, w * 0.5, 110, sol(p.dark, "dark"), { cornerRadius: 55, colorRole: "dark" }),
        textEl("Author", w * 0.25, h * 0.86 + 28, w * 0.5, t.author, { fontFamily: body, fontSize: 48, fontWeight: 700, uppercase: true, letterSpacing: 3, fill: p.light, colorRole: "light", fontRole: "body", bind: "author" }),
      ],
    }),
  },
  {
    id: "modern-stripe",
    name: "Modern Stripe",
    category: "ebook",
    size: EBOOK,
    palette: { primary: "#111827", secondary: "#374151", accent: "#ef4444", dark: "#030712", light: "#f9fafb" },
    heading: "archivo-black",
    body: "inter",
    build: ({ w, h, p, heading, body, t }) => ({
      background: sol(p.primary, "primary"),
      elements: [
        rectEl("Stripe 1", -w * 0.2, h * 0.7, w * 1.6, 120, sol(p.accent, "accent"), { rotation: -12, colorRole: "accent" }),
        rectEl("Stripe 2", -w * 0.2, h * 0.76, w * 1.6, 40, sol(p.secondary, "secondary"), { rotation: -12, colorRole: "secondary" }),
        textEl("Title", w * 0.08, h * 0.16, w * 0.84, t.title, { fontFamily: heading, fontSize: 170, fontWeight: 400, uppercase: true, align: "left", lineHeight: 1.0, fill: p.light, colorRole: "light", bind: "title" }),
        textEl("Subtitle", w * 0.08, h * 0.5, w * 0.8, t.subtitle, { fontFamily: body, fontSize: 62, fontWeight: 500, align: "left", lineHeight: 1.3, fill: p.light, opacity: 0.8, colorRole: "light", fontRole: "body", bind: "subtitle" }),
        textEl("Author", w * 0.08, h * 0.9, w * 0.84, t.author, { fontFamily: body, fontSize: 52, fontWeight: 700, align: "left", letterSpacing: 4, uppercase: true, fill: p.light, colorRole: "light", fontRole: "body", bind: "author" }),
      ],
    }),
  },
  {
    id: "executive-report",
    name: "Executive Report",
    category: "report",
    size: REPORT,
    palette: { primary: "#1d4ed8", secondary: "#1e3a8a", accent: "#38bdf8", dark: "#0f172a", light: "#ffffff" },
    heading: "montserrat",
    body: "inter",
    build: ({ w, h, p, heading, body, t }) => ({
      background: sol(p.light, "light"),
      elements: [
        rectEl("Sidebar", 0, 0, w * 0.1, h, lin(180, [p.primary, "primary"], [p.secondary, "secondary"])),
        textEl("Eyebrow", w * 0.18, h * 0.16, w * 0.7, t.tagline || "SPECIAL REPORT", { fontFamily: body, fontSize: 46, fontWeight: 700, letterSpacing: 10, uppercase: true, align: "left", fill: p.primary, colorRole: "primary", fontRole: "body", bind: "tagline" }),
        textEl("Title", w * 0.18, h * 0.22, w * 0.72, t.title, { fontFamily: heading, fontSize: 140, fontWeight: 800, align: "left", lineHeight: 1.05, fill: p.dark, colorRole: "dark", bind: "title" }),
        rectEl("Accent", w * 0.18, h * 0.55, 220, 14, sol(p.accent, "accent"), { colorRole: "accent" }),
        textEl("Subtitle", w * 0.18, h * 0.58, w * 0.7, t.subtitle, { fontFamily: body, fontSize: 56, fontWeight: 400, align: "left", lineHeight: 1.35, fill: p.dark, opacity: 0.75, colorRole: "dark", fontRole: "body", bind: "subtitle" }),
        textEl("Author", w * 0.18, h * 0.9, w * 0.7, t.author, { fontFamily: body, fontSize: 44, fontWeight: 600, align: "left", fill: p.dark, colorRole: "dark", fontRole: "body", bind: "author" }),
      ],
    }),
  },
  {
    id: "night-report",
    name: "Night Report",
    category: "report",
    size: REPORT,
    palette: { primary: "#7c3aed", secondary: "#0f172a", accent: "#22d3ee", dark: "#020617", light: "#f8fafc" },
    heading: "poppins",
    body: "inter",
    build: ({ w, h, p, heading, body, t }) => ({
      background: lin(145, [p.secondary, "secondary"], [p.dark, "dark"]),
      elements: [
        ellipseEl("Orb", w * 0.45, h * 0.05, w * 0.8, w * 0.8, { kind: "radial", stops: [stop(0, p.primary, "primary"), stop(1, "rgba(0,0,0,0)")] }, { opacity: 0.7 }),
        textEl("Eyebrow", w * 0.1, h * 0.36, w * 0.8, t.tagline || "FREE REPORT", { fontFamily: body, fontSize: 44, fontWeight: 700, letterSpacing: 12, uppercase: true, align: "left", fill: p.accent, colorRole: "accent", fontRole: "body", bind: "tagline" }),
        textEl("Title", w * 0.1, h * 0.42, w * 0.8, t.title, { fontFamily: heading, fontSize: 136, fontWeight: 800, align: "left", lineHeight: 1.05, fill: p.light, colorRole: "light", bind: "title" }),
        textEl("Subtitle", w * 0.1, h * 0.72, w * 0.75, t.subtitle, { fontFamily: body, fontSize: 52, fontWeight: 400, align: "left", lineHeight: 1.35, fill: p.light, opacity: 0.8, colorRole: "light", fontRole: "body", bind: "subtitle" }),
        textEl("Author", w * 0.1, h * 0.9, w * 0.8, t.author, { fontFamily: body, fontSize: 44, fontWeight: 600, align: "left", letterSpacing: 3, uppercase: true, fill: p.light, opacity: 0.85, colorRole: "light", fontRole: "body", bind: "author" }),
      ],
    }),
  },
  {
    id: "workbook-clean",
    name: "Workbook Clean",
    category: "workbook",
    size: WORKBOOK,
    palette: { primary: "#f97316", secondary: "#fed7aa", accent: "#0ea5e9", dark: "#1c1917", light: "#fffaf5" },
    heading: "poppins",
    body: "nunito",
    build: ({ w, h, p, heading, body, t }) => ({
      background: sol(p.light, "light"),
      elements: [
        rectEl("Header band", 0, 0, w, h * 0.08, sol(p.primary, "primary"), { colorRole: "primary" }),
        ...Array.from({ length: 5 }, (_, i) => lineEl(`Line ${i + 1}`, w * 0.1, h * (0.66 + i * 0.045), w * 0.8, p.secondary, 4, { colorRole: "secondary" })),
        rectEl("Label", w * 0.1, h * 0.16, 420, 96, sol(p.dark, "dark"), { cornerRadius: 48, colorRole: "dark" }),
        textEl("Label text", w * 0.1, h * 0.16 + 26, 420, "WORKBOOK", { fontFamily: body, fontSize: 44, fontWeight: 800, letterSpacing: 8, fill: p.light, colorRole: "light", fontRole: "body" }),
        textEl("Title", w * 0.1, h * 0.25, w * 0.8, t.title, { fontFamily: heading, fontSize: 150, fontWeight: 800, align: "left", lineHeight: 1.05, fill: p.dark, colorRole: "dark", bind: "title" }),
        textEl("Subtitle", w * 0.1, h * 0.52, w * 0.78, t.subtitle, { fontFamily: body, fontSize: 56, fontWeight: 400, align: "left", lineHeight: 1.35, fill: p.dark, opacity: 0.75, colorRole: "dark", fontRole: "body", bind: "subtitle" }),
        textEl("Author", w * 0.1, h * 0.92, w * 0.8, t.author, { fontFamily: body, fontSize: 46, fontWeight: 700, align: "left", fill: p.primary, colorRole: "primary", fontRole: "body", bind: "author" }),
      ],
    }),
  },
  {
    id: "workbook-playful",
    name: "Workbook Playful",
    category: "workbook",
    size: WORKBOOK,
    palette: { primary: "#14b8a6", secondary: "#a7f3d0", accent: "#facc15", dark: "#134e4a", light: "#f0fdfa" },
    heading: "nunito",
    body: "nunito",
    build: ({ w, h, p, heading, body, t }) => ({
      background: sol(p.light, "light"),
      elements: [
        ellipseEl("Blob 1", -w * 0.2, -h * 0.08, w * 0.8, w * 0.8, sol(p.secondary, "secondary"), { colorRole: "secondary" }),
        ellipseEl("Blob 2", w * 0.6, h * 0.75, w * 0.7, w * 0.7, sol(p.accent, "accent"), { opacity: 0.6, colorRole: "accent" }),
        textEl("Title", w * 0.1, h * 0.3, w * 0.8, t.title, { fontFamily: heading, fontSize: 160, fontWeight: 800, lineHeight: 1.05, fill: p.dark, colorRole: "dark", bind: "title" }),
        textEl("Subtitle", w * 0.12, h * 0.56, w * 0.76, t.subtitle, { fontFamily: body, fontSize: 58, fontWeight: 400, lineHeight: 1.35, fill: p.dark, opacity: 0.85, colorRole: "dark", fontRole: "body", bind: "subtitle" }),
        rectEl("Badge", w * 0.33, h * 0.18, w * 0.34, 100, sol(p.primary, "primary"), { cornerRadius: 50, colorRole: "primary" }),
        textEl("Badge text", w * 0.33, h * 0.18 + 26, w * 0.34, "WORKBOOK", { fontFamily: body, fontSize: 46, fontWeight: 800, letterSpacing: 6, uppercase: true, fill: "#ffffff", fontRole: "body" }),
        textEl("Author", w * 0.1, h * 0.9, w * 0.8, t.author, { fontFamily: body, fontSize: 48, fontWeight: 700, fill: p.dark, colorRole: "dark", fontRole: "body", bind: "author" }),
      ],
    }),
  },
  {
    id: "course-banner",
    name: "Course Banner",
    category: "course",
    size: COURSE,
    palette: { primary: "#5b4df5", secondary: "#312e81", accent: "#f5b544", dark: "#0f1222", light: "#ffffff" },
    heading: "montserrat",
    body: "inter",
    build: ({ w, h, p, heading, body, t }) => ({
      background: lin(120, [p.secondary, "secondary"], [p.primary, "primary"]),
      elements: [
        ellipseEl("Ring", w * 0.66, h * 0.1, h * 0.9, h * 0.9, solid("rgba(0,0,0,0)"), { stroke: p.accent, strokeWidth: 26, opacity: 0.9 }),
        ellipseEl("Disc", w * 0.72, h * 0.22, h * 0.66, h * 0.66, sol(p.accent, "accent"), { opacity: 0.18, colorRole: "accent" }),
        textEl("Eyebrow", w * 0.07, h * 0.18, w * 0.55, t.tagline || "ONLINE COURSE", { fontFamily: body, fontSize: 36, fontWeight: 700, letterSpacing: 10, uppercase: true, align: "left", fill: p.accent, colorRole: "accent", fontRole: "body", bind: "tagline" }),
        textEl("Title", w * 0.07, h * 0.28, w * 0.58, t.title, { fontFamily: heading, fontSize: 104, fontWeight: 800, align: "left", lineHeight: 1.05, fill: p.light, colorRole: "light", bind: "title" }),
        textEl("Subtitle", w * 0.07, h * 0.66, w * 0.55, t.subtitle, { fontFamily: body, fontSize: 40, fontWeight: 400, align: "left", lineHeight: 1.35, fill: p.light, opacity: 0.85, colorRole: "light", fontRole: "body", bind: "subtitle" }),
        textEl("Author", w * 0.07, h * 0.86, w * 0.55, t.author, { fontFamily: body, fontSize: 34, fontWeight: 600, align: "left", fill: p.light, opacity: 0.85, colorRole: "light", fontRole: "body", bind: "author" }),
      ],
    }),
  },
  {
    id: "module-card",
    name: "Module Card",
    category: "course",
    size: COURSE,
    palette: { primary: "#0f172a", secondary: "#1e293b", accent: "#10b981", dark: "#020617", light: "#f8fafc" },
    heading: "poppins",
    body: "inter",
    build: ({ w, h, p, heading, body, t }) => ({
      background: sol(p.primary, "primary"),
      elements: [
        rectEl("Card", w * 0.06, h * 0.1, w * 0.88, h * 0.8, sol(p.secondary, "secondary"), { cornerRadius: 40, colorRole: "secondary" }),
        rectEl("Accent", w * 0.06, h * 0.1, 24, h * 0.8, sol(p.accent, "accent"), { cornerRadius: 12, colorRole: "accent" }),
        textEl("Eyebrow", w * 0.12, h * 0.24, w * 0.7, t.tagline || "MODULE 1", { fontFamily: body, fontSize: 40, fontWeight: 700, letterSpacing: 8, uppercase: true, align: "left", fill: p.accent, colorRole: "accent", fontRole: "body", bind: "tagline" }),
        textEl("Title", w * 0.12, h * 0.34, w * 0.76, t.title, { fontFamily: heading, fontSize: 110, fontWeight: 800, align: "left", lineHeight: 1.05, fill: p.light, colorRole: "light", bind: "title" }),
        textEl("Subtitle", w * 0.12, h * 0.68, w * 0.7, t.subtitle, { fontFamily: body, fontSize: 40, fontWeight: 400, align: "left", lineHeight: 1.35, fill: p.light, opacity: 0.8, colorRole: "light", fontRole: "body", bind: "subtitle" }),
      ],
    }),
  },
  {
    id: "free-checklist",
    name: "Free Checklist",
    category: "lead-magnet",
    size: LEAD,
    palette: { primary: "#e11d48", secondary: "#ffe4e6", accent: "#111827", dark: "#111827", light: "#ffffff" },
    heading: "montserrat",
    body: "inter",
    build: ({ w, h, p, heading, body, t }) => ({
      background: sol(p.secondary, "secondary"),
      elements: [
        rectEl("Card", w * 0.07, h * 0.06, w * 0.86, h * 0.88, sol(p.light, "light"), { cornerRadius: 36, colorRole: "light" }),
        rectEl("FREE pill", w * 0.36, h * 0.12, w * 0.28, 76, sol(p.primary, "primary"), { cornerRadius: 38, colorRole: "primary" }),
        textEl("FREE", w * 0.36, h * 0.12 + 18, w * 0.28, "FREE", { fontFamily: body, fontSize: 40, fontWeight: 800, letterSpacing: 6, uppercase: true, fill: "#ffffff", fontRole: "body" }),
        textEl("Title", w * 0.12, h * 0.25, w * 0.76, t.title, { fontFamily: heading, fontSize: 88, fontWeight: 800, lineHeight: 1.08, fill: p.dark, colorRole: "dark", bind: "title" }),
        ...[0, 1, 2].map((i) => rectEl(`Check ${i + 1}`, w * 0.2, h * (0.58 + i * 0.08), 44, 44, solid("rgba(0,0,0,0)"), { cornerRadius: 10, stroke: p.primary, strokeWidth: 6 })),
        ...[0, 1, 2].map((i) => rectEl(`Check line ${i + 1}`, w * 0.2 + 70, h * (0.58 + i * 0.08) + 16, w * 0.48, 12, solid("#e5e7eb"), { cornerRadius: 6 })),
        textEl("Subtitle", w * 0.12, h * 0.84, w * 0.76, t.subtitle, { fontFamily: body, fontSize: 34, fontWeight: 500, lineHeight: 1.3, fill: p.dark, opacity: 0.7, colorRole: "dark", fontRole: "body", bind: "subtitle" }),
      ],
    }),
  },
  {
    id: "cheat-sheet",
    name: "Cheat Sheet",
    category: "lead-magnet",
    size: LEAD,
    palette: { primary: "#facc15", secondary: "#0f172a", accent: "#22c55e", dark: "#0f172a", light: "#fefce8" },
    heading: "bebas",
    body: "inter",
    build: ({ w, h, p, heading, body, t }) => ({
      background: sol(p.primary, "primary"),
      elements: [
        rectEl("Dark panel", 0, h * 0.62, w, h * 0.38, sol(p.secondary, "secondary"), { colorRole: "secondary" }),
        textEl("Eyebrow", w * 0.08, h * 0.08, w * 0.84, t.tagline || "CHEAT SHEET", { fontFamily: body, fontSize: 40, fontWeight: 800, letterSpacing: 10, uppercase: true, fill: p.dark, colorRole: "dark", fontRole: "body", bind: "tagline" }),
        textEl("Title", w * 0.06, h * 0.16, w * 0.88, t.title, { fontFamily: heading, fontSize: 150, fontWeight: 400, uppercase: true, lineHeight: 0.95, fill: p.dark, colorRole: "dark", bind: "title" }),
        textEl("Subtitle", w * 0.1, h * 0.7, w * 0.8, t.subtitle, { fontFamily: body, fontSize: 38, fontWeight: 500, lineHeight: 1.35, fill: p.light, colorRole: "light", fontRole: "body", bind: "subtitle" }),
        textEl("Author", w * 0.1, h * 0.9, w * 0.8, t.author, { fontFamily: body, fontSize: 32, fontWeight: 700, letterSpacing: 3, uppercase: true, fill: p.primary, colorRole: "primary", fontRole: "body", bind: "author" }),
      ],
    }),
  },
];

export function buildFromTemplate(tpl: CoverTemplate, texts: TemplateText, opts: { palette?: Partial<Palette>; heading?: string; body?: string; size?: { w: number; h: number } } = {}): CoverData {
  const size = opts.size ?? tpl.size;
  const p = { ...tpl.palette, ...(opts.palette ?? {}) };
  const built = tpl.build({ w: size.w, h: size.h, p, heading: opts.heading ?? tpl.heading, body: opts.body ?? tpl.body, t: texts });
  return {
    width: size.w,
    height: size.h,
    background: built.background,
    backgroundImageFileId: null,
    backgroundImageOpacity: 1,
    elements: built.elements,
    category: tpl.category,
    templateId: tpl.id,
    thumbnail: null,
    renderFileId: null,
    renderedAt: null,
  };
}

/** Recolours/re-fonts every element and gradient stop that follows a brand role. */
export function applyPalette(data: CoverData, palette: Partial<Palette>, fonts: { heading?: string; body?: string } = {}): CoverData {
  const recolorFill = (f: Fill): Fill => {
    if (f.kind === "solid") return f.role && palette[f.role] ? { ...f, color: palette[f.role]! } : f;
    return { ...f, stops: f.stops.map((s) => (s.role && palette[s.role] ? { ...s, color: palette[s.role]! } : s)) } as Fill;
  };
  return {
    ...data,
    background: recolorFill(data.background),
    elements: data.elements.map((el) => {
      const role = el.colorRole;
      const color = role ? palette[role] : undefined;
      switch (el.type) {
        case "text":
          return { ...el, fill: color ?? el.fill, fontFamily: el.fontRole === "heading" && fonts.heading ? fonts.heading : el.fontRole === "body" && fonts.body ? fonts.body : el.fontFamily };
        case "rect":
        case "ellipse": {
          const fill = recolorFill(el.fill);
          return { ...el, fill: color && fill.kind === "solid" ? { ...fill, color } : fill };
        }
        case "line":
          return { ...el, stroke: color ?? el.stroke };
        default:
          return el;
      }
    }),
  };
}

export function fillBoundText(data: CoverData, texts: Partial<TemplateText>): CoverData {
  return { ...data, elements: data.elements.map((el) => (el.type === "text" && el.bind && texts[el.bind] ? { ...el, text: texts[el.bind]! } : el)) };
}

export function blankCover(size: { w: number; h: number }, category: CoverCategory = "custom"): CoverData {
  return {
    width: size.w,
    height: size.h,
    background: linear(160, "#1e1b4b", "#4338ca"),
    backgroundImageFileId: null,
    backgroundImageOpacity: 1,
    elements: [textEl("Title", size.w * 0.1, size.h * 0.35, size.w * 0.8, "Your Title Here", { fontSize: Math.round(size.w / 10), bind: "title" })],
    category,
    templateId: null,
    thumbnail: null,
    renderFileId: null,
    renderedAt: null,
  };
}
