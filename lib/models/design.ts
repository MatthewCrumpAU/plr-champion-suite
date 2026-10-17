/* ------------------------------------------------------------------ */
/* Shared fill type (covers, mockups, sales pages)                     */
/* ------------------------------------------------------------------ */
export type ColorRole = "primary" | "secondary" | "accent" | "dark" | "light";

export interface GradientStop {
  offset: number;
  color: string;
  /** Brand colour this stop follows when a brand kit is applied. */
  role?: ColorRole;
}
export type Fill = { kind: "solid"; color: string; role?: ColorRole } | { kind: "linear"; angle: number; stops: GradientStop[] } | { kind: "radial"; stops: GradientStop[] };

export const solid = (color: string, role?: ColorRole): Fill => ({ kind: "solid", color, ...(role ? { role } : {}) }) as Fill;
export const linear = (angle: number, ...colors: string[]): Fill => ({
  kind: "linear",
  angle,
  stops: colors.map((color, i) => ({ offset: colors.length === 1 ? 0 : i / (colors.length - 1), color })),
});

/* ------------------------------------------------------------------ */
/* Cover Creator                                                        */
/* ------------------------------------------------------------------ */
export interface CoverElementBase {
  id: string;
  name: string;
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  /** Brand colour role for the element's main colour (fill for text/shapes, stroke for lines). */
  colorRole?: ColorRole | null;
}

export interface TextShadow {
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
  opacity: number;
}

export interface CoverTextElement extends CoverElementBase {
  type: "text";
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700 | 800 | 900;
  italic: boolean;
  fill: string;
  align: "left" | "center" | "right";
  width: number;
  lineHeight: number;
  letterSpacing: number;
  uppercase: boolean;
  stroke: string | null;
  strokeWidth: number;
  shadow: TextShadow | null;
  /** Binding to a project field so templates fill in automatically. */
  bind: "title" | "subtitle" | "author" | "tagline" | "brand" | null;
  /** Which brand font this text follows when a brand kit is applied. */
  fontRole?: "heading" | "body" | null;
  /** Shrink the font just enough to keep the longest word on one line (default on). */
  fitWords?: boolean;
}

export interface CoverShapeElement extends CoverElementBase {
  type: "rect" | "ellipse";
  width: number;
  height: number;
  fill: Fill;
  cornerRadius: number;
  stroke: string | null;
  strokeWidth: number;
}

export interface CoverLineElement extends CoverElementBase {
  type: "line";
  width: number;
  stroke: string;
  strokeWidth: number;
  dash: boolean;
}

export interface CoverImageElement extends CoverElementBase {
  type: "image";
  fileId: string | null;
  width: number;
  height: number;
  /** "brand-logo" pulls the logo from the active brand kit. */
  source: "file" | "brand-logo";
  cornerRadius: number;
}

export type CoverElement = CoverTextElement | CoverShapeElement | CoverLineElement | CoverImageElement;

export type CoverCategory = "ebook" | "report" | "workbook" | "course" | "lead-magnet" | "custom";

export interface CoverData {
  width: number;
  height: number;
  background: Fill;
  backgroundImageFileId: string | null;
  backgroundImageOpacity: number;
  elements: CoverElement[];
  category: CoverCategory;
  templateId: string | null;
  /** Small JPEG data URL for lists (regenerated on save). */
  thumbnail: string | null;
  /** Full-resolution PNG stored in the files table, used by Mockup Studio. */
  renderFileId: string | null;
  renderedAt: string | null;
}

export function defaultCoverData(partial: Partial<CoverData> = {}): CoverData {
  return {
    width: 1600,
    height: 2560,
    background: linear(160, "#1e1b4b", "#4338ca"),
    backgroundImageFileId: null,
    backgroundImageOpacity: 1,
    elements: [],
    category: "ebook",
    templateId: null,
    thumbnail: null,
    renderFileId: null,
    renderedAt: null,
    ...partial,
  };
}

export function normalizeCoverData(raw: unknown): CoverData {
  const d = (raw ?? {}) as Partial<CoverData>;
  return { ...defaultCoverData(), ...d, elements: Array.isArray(d.elements) ? d.elements : [] };
}

/* ------------------------------------------------------------------ */
/* Mockup Studio                                                        */
/* ------------------------------------------------------------------ */
export type MockupKind = "flat" | "ebook-3d" | "paperback" | "workbook" | "tablet" | "laptop" | "bundle" | "course-bundle";

export interface MockupSource {
  id: string;
  kind: "cover" | "file";
  /** Cover asset id or stored file id. */
  refId: string;
}

export interface MockupData {
  kind: MockupKind;
  sources: MockupSource[];
  canvas: { width: number; height: number };
  background: Fill | { kind: "transparent" };
  shadow: { enabled: boolean; blur: number; opacity: number; offsetX: number; offsetY: number; floor: boolean };
  layout: {
    scale: number;
    offsetX: number;
    offsetY: number;
    angle: number;
    spacing: number;
    spineColor: string | null;
    spineWidth: number;
    reflection: boolean;
    deviceColor: "dark" | "silver" | "light";
  };
  caption: { text: string; color: string; size: number; enabled: boolean; font?: string };
  thumbnail: string | null;
  /** Design + source revision signature the thumbnail was rendered from. */
  thumbnailKey?: string | null;
}

export function defaultMockupData(partial: Partial<MockupData> = {}): MockupData {
  return {
    kind: "ebook-3d",
    sources: [],
    canvas: { width: 1600, height: 1200 },
    background: linear(135, "#eef0ff", "#f8fafc"),
    shadow: { enabled: true, blur: 40, opacity: 0.35, offsetX: 18, offsetY: 26, floor: true },
    layout: { scale: 1, offsetX: 0, offsetY: 0, angle: 18, spacing: 0.55, spineColor: null, spineWidth: 0.07, reflection: false, deviceColor: "dark" },
    caption: { text: "", color: "#0f1222", size: 56, enabled: false, font: "montserrat" },
    thumbnail: null,
    ...partial,
  };
}

export function normalizeMockupData(raw: unknown): MockupData {
  const d = (raw ?? {}) as Partial<MockupData>;
  const def = defaultMockupData();
  return {
    ...def,
    ...d,
    canvas: { ...def.canvas, ...(d.canvas ?? {}) },
    shadow: { ...def.shadow, ...(d.shadow ?? {}) },
    layout: { ...def.layout, ...(d.layout ?? {}) },
    caption: { ...def.caption, ...(d.caption ?? {}) },
    sources: Array.isArray(d.sources) ? d.sources : [],
  };
}

/* ------------------------------------------------------------------ */
/* Brand Kits (own table, not project assets)                           */
/* ------------------------------------------------------------------ */
export interface BrandKit {
  id: string;
  name: string;
  brandName: string;
  tagline: string;
  logoFileId: string | null;
  colors: { primary: string; secondary: string; accent: string; dark: string; light: string };
  palette: string[];
  headingFont: string;
  bodyFont: string;
  authorName: string;
  website: string;
  email: string;
  voice: string;
  positioning: string;
  audience: string;
  notes: string;
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
}
