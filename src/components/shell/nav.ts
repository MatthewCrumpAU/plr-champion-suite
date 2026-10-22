import {
  LayoutDashboard,
  FileText,
  Sparkles,
  Wand2,
  ListTree,
  BookImage,
  Boxes,
  Palette,
  Hammer,
  Gift,
  Magnet,
  Radar,
  Compass,
  KeySquare,
  ShieldCheck,
  PanelsTopLeft,
  Mails,
  Share2,
  Tag,
  Calculator,
  Workflow,
  Rocket,
  BriefcaseBusiness,
  FolderKanban,
  Download,
  Settings,
  Crown,
  ChartNoAxesCombined,
  LayoutGrid,
  FlaskConical,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
}

export interface NavSection {
  id: string;
  title: string | null;
  items: NavItem[];
}

export const NAV: NavSection[] = [
  { id: "home", title: null, items: [{ label: "Dashboard", href: "/", icon: LayoutDashboard, description: "Overview of your projects and next steps" }] },
  {
    id: "content",
    title: "Content Studio",
    items: [
      { label: "PLR Editor", href: "/editor", icon: FileText, description: "Import, edit, compare and export PLR documents" },
      { label: "AI Writer", href: "/ai-writer", icon: Sparkles, description: "Write and transform content with templates or AI" },
      { label: "Rebrand Assistant", href: "/rebrand", icon: Wand2, description: "Guided rebrand with selective acceptance" },
      { label: "Outline Generator", href: "/outlines", icon: ListTree, description: "Editable outlines for any product format" },
    ],
  },
  {
    id: "design",
    title: "Design Studio",
    items: [
      { label: "Cover Creator", href: "/covers", icon: BookImage, description: "Design and export product covers" },
      { label: "Mockup Studio", href: "/mockups", icon: Boxes, description: "3D books, devices and bundle images" },
      { label: "Brand Kits", href: "/brand-kits", icon: Palette, description: "Reusable logos, colours, fonts and voice" },
    ],
  },
  {
    id: "product",
    title: "Product Studio",
    items: [
      { label: "Product Builder", href: "/product-builder", icon: Hammer, description: "Turn PLR into new products" },
      { label: "Bonus Builder", href: "/bonus-builder", icon: Gift, description: "Create complementary bonuses" },
      { label: "Lead Magnet Creator", href: "/lead-magnets", icon: Magnet, description: "Build free opt-in gifts" },
      { label: "Opportunity Scanner", href: "/opportunities", icon: Radar, description: "Find more products inside your PLR" },
    ],
  },
  {
    id: "research",
    title: "Research Studio",
    items: [
      { label: "Niche Research", href: "/niche-research", icon: Compass, description: "Audience needs, problems, personas and ideas" },
      { label: "Keyword Finder", href: "/keywords", icon: KeySquare, description: "Organise and cluster keywords" },
      { label: "PLR Rights Review", href: "/rights", icon: ShieldCheck, description: "Record and review licence terms" },
    ],
  },
  {
    id: "marketing",
    title: "Marketing Studio",
    items: [
      { label: "Sales Page Builder", href: "/sales-pages", icon: PanelsTopLeft, description: "Section-based sales copy with live preview" },
      { label: "Email Swipe Builder", href: "/emails", icon: Mails, description: "Promotional email sequences" },
      { label: "Social Content Creator", href: "/social", icon: Share2, description: "Posts, scripts and a content calendar" },
      { label: "Product Name Generator", href: "/names", icon: Tag, description: "Titles, taglines and offer names" },
    ],
  },
  {
    id: "profit",
    title: "Profit Studio",
    items: [
      { label: "Profit Calculator", href: "/profit", icon: Calculator, description: "Pricing, costs, break-even and scenarios" },
      { label: "Funnel Planner", href: "/funnels", icon: Workflow, description: "Drag-and-drop funnel with projections" },
      { label: "Launch Planner", href: "/launch", icon: Rocket, description: "Tasks, checklists and launch calendar" },
      { label: "Product Portfolio", href: "/portfolio", icon: BriefcaseBusiness, description: "Every product you've created" },
    ],
  },
  {
    id: "memberships",
    title: "Memberships",
    items: [
      { label: "PLR Champion Members", href: "/m/plr-champion", icon: Crown, description: "Member library, downloads, training and tools" },
      { label: "PLRforIM Members", href: "/m/plrforim", icon: ChartNoAxesCombined, description: "Internet-marketing PLR library, swipes and training" },
      { label: "PLR Profit Lab", href: "/m/plr-profit-lab", icon: FlaskConical, description: "90-Day Profit Path, Campaign Drops and Build Days" },
      { label: "Membership Admin", href: "/m/plr-champion/admin", icon: LayoutGrid, description: "Products, categories, releases and access for each brand" },
    ],
  },
  {
    id: "workspace",
    title: "Workspace",
    items: [
      { label: "Projects", href: "/projects", icon: FolderKanban, description: "Create, organise and recover projects" },
      { label: "Export Centre", href: "/export", icon: Download, description: "Exports, ZIP packages and backups" },
      { label: "Settings", href: "/settings", icon: Settings, description: "AI, storage, backups and security" },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV.flatMap((s) => s.items.map((i) => ({ ...i, section: s.title })));

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function findNav(pathname: string) {
  return ALL_NAV_ITEMS.find((i) => isActive(pathname, i.href) && i.href !== "/") ?? (pathname === "/" ? ALL_NAV_ITEMS[0] : undefined);
}
