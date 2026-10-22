import {
  CalendarDays,
  CalendarRange,
  Megaphone,
  Route,
  UserRoundCog,
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
  Users,
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
  const f = brand.features;
  const sections: MemberNavSection[] = [{ id: "home", title: null, items: [{ label: "Dashboard", path: "", icon: LayoutDashboard, exact: true }] }];
  if (f.lab) {
    sections.push({
      id: "lab",
      title: "Profit Lab",
      items: [
        { label: "90-Day Profit Path", path: "profit-path", icon: Route },
        { label: "Campaign Drops", path: "campaigns", icon: Megaphone },
        { label: "Build Days", path: "build-days", icon: CalendarDays },
      ],
    });
  }
  if (f.library) {
    sections.push(
      {
        id: "library",
        title: "Library",
        items: [
          { label: "PLR Product Library", path: "library", icon: LibraryBig },
          { label: "Product Categories", path: "categories", icon: Shapes },
          { label: "Advanced Search", path: "search", icon: Search },
          ...(f.drops ? [{ label: `${brand.dropName}s`, path: "drops", icon: CalendarRange }] : []),
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
    );
  }
  if (f.training || f.resources) {
    sections.push({
      id: "learn",
      title: "Learn",
      items: [
        ...(f.training
          ? [
              { label: "Training Centre", path: "training", icon: GraduationCap },
              { label: "Courses & Tutorials", path: "courses", icon: PlayCircle },
            ]
          : []),
        ...(f.resources ? [{ label: "Member Resources", path: "resources", icon: Package }] : []),
      ],
    });
  }
  if (f.tools) {
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
        ...(f.library
          ? [
              { label: "Products", path: "admin/products", icon: Archive },
              { label: "Categories", path: "admin/categories", icon: Tags },
              { label: "Releases", path: "admin/releases", icon: CalendarRange },
            ]
          : []),
        ...(f.lab
          ? [
              { label: "Campaign Drop Creator", path: "admin/campaigns", icon: Megaphone },
              { label: "Build Day Planner", path: "admin/build-days", icon: CalendarDays },
              { label: "Profit Path profiles", path: "admin/profit-paths", icon: UserRoundCog },
            ]
          : []),
        { label: "Training", path: "admin/courses", icon: ListChecks },
        { label: "Resources", path: "admin/resources", icon: Package },
        { label: "Members & access", path: "admin/access", icon: Users },
        { label: "Data & backup", path: "admin/data", icon: Database },
      ],
    });
  }
  return sections;
}

/** Areas that belong to one kind of membership. A brand without the feature shows a "not part of" page. */
const FEATURE_ROUTES: { feature: keyof BrandConfig["features"]; paths: string[] }[] = [
  { feature: "library", paths: ["library", "categories", "search", "downloads", "my-downloads", "drops", "admin/products", "admin/categories", "admin/releases"] },
  { feature: "drops", paths: ["drops"] },
  { feature: "lab", paths: ["profit-path", "campaigns", "build-days", "admin/campaigns", "admin/build-days", "admin/profit-paths"] },
  { feature: "tools", paths: ["tools"] },
  { feature: "training", paths: ["training", "courses"] },
  { feature: "resources", paths: ["resources"] },
];

/** Is a path inside the brand area (e.g. "library/x", "admin/campaigns") switched on for this brand? */
export function routeAllowed(brand: BrandConfig, path: string): boolean {
  const p = path.replace(/^\/+|\/+$/g, "");
  const within = (r: string) => p === r || p.startsWith(`${r}/`);
  return FEATURE_ROUTES.every((g) => brand.features[g.feature] || !g.paths.some(within));
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
