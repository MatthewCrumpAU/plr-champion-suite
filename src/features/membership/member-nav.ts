import {
  CalendarRange,
  Database,
  FileText,
  FolderDown,
  GraduationCap,
  Hammer,
  History,
  LayoutDashboard,
  LayoutGrid,
  LibraryBig,
  ListChecks,
  Package,
  PlayCircle,
  Search,
  Shapes,
  Tags,
  Wand2,
  Workflow,
  Archive,
  type LucideIcon,
} from "lucide-react";
import type { BrandConfig } from "@/lib/membership/brands";

export interface MemberNavItem {
  label: string;
  /** Path inside the brand area ("" = dashboard). */
  path: string;
  icon: LucideIcon;
  exact?: boolean;
}

export interface MemberNavSection {
  id: string;
  title: string | null;
  items: MemberNavItem[];
}

export function memberNav(brand: BrandConfig, isAdmin: boolean): MemberNavSection[] {
  const sections: MemberNavSection[] = [
    { id: "home", title: null, items: [{ label: "Dashboard", path: "", icon: LayoutDashboard, exact: true }] },
    {
      id: "library",
      title: "Library",
      items: [
        { label: "PLR Product Library", path: "library", icon: LibraryBig },
        { label: "Product Categories", path: "categories", icon: Shapes },
        { label: "Advanced Search", path: "search", icon: Search },
        ...(brand.features.drops ? [{ label: `${brand.dropName}s`, path: "drops", icon: CalendarRange }] : []),
      ],
    },
    {
      id: "downloads",
      title: "Downloads",
      items: [
        { label: "Download Manager", path: "downloads", icon: FolderDown },
        { label: "My Downloads", path: "my-downloads", icon: History },
      ],
    },
  ];
  if (brand.features.training || brand.features.resources) {
    sections.push({
      id: "learn",
      title: "Learn",
      items: [
        ...(brand.features.training
          ? [
              { label: "Training Centre", path: "training", icon: GraduationCap },
              { label: "Courses & Tutorials", path: "courses", icon: PlayCircle },
            ]
          : []),
        ...(brand.features.resources ? [{ label: "Member Resources", path: "resources", icon: Package }] : []),
      ],
    });
  }
  if (brand.features.tools) {
    sections.push({
      id: "build",
      title: "Build",
      items: [
        { label: "PLR Editor", path: "tools/editor", icon: FileText },
        { label: "Rebrand Studio", path: "tools/rebrand", icon: Wand2 },
        { label: "Product Builder", path: "tools/builder", icon: Hammer },
        { label: "Profit Map", path: "tools/profit-map", icon: Workflow },
      ],
    });
  }
  if (isAdmin) {
    sections.push({
      id: "admin",
      title: "Membership Admin",
      items: [
        { label: "Admin overview", path: "admin", icon: LayoutGrid, exact: true },
        { label: "Products", path: "admin/products", icon: Archive },
        { label: "Categories", path: "admin/categories", icon: Tags },
        { label: "Releases", path: "admin/releases", icon: CalendarRange },
        { label: "Training", path: "admin/courses", icon: ListChecks },
        { label: "Resources", path: "admin/resources", icon: Package },
        { label: "Data & backup", path: "admin/data", icon: Database },
      ],
    });
  }
  return sections;
}

/** Studio paths used by embedded tools → where they live in the member area. */
export function memberToolRoutes(base: string): Record<string, string> {
  return {
    "/editor": `${base}/tools/editor`,
    "/rebrand": `${base}/tools/rebrand`,
    "/product-builder": `${base}/tools/builder`,
    "/funnels": `${base}/tools/profit-map`,
  };
}

/** Training "Try it" buttons. */
export const TOOL_HINTS: Record<string, { label: string; path: string }> = {
  editor: { label: "PLR Editor", path: "tools/editor" },
  rebrand: { label: "Rebrand Studio", path: "tools/rebrand" },
  builder: { label: "Product Builder", path: "tools/builder" },
  "profit-map": { label: "Profit Map", path: "tools/profit-map" },
};
