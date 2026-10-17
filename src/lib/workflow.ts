import type { Asset, Project } from "@/lib/data/types";

/**
 * The end-to-end PLR workflow every project follows. Each step is "done" when the project actually contains the
 * matching work — nothing here is a guess or a fake percentage.
 */
export interface WorkflowStep {
  id: string;
  label: string;
  hint: string;
  href: string;
  done: (assets: Asset[], project: Project) => boolean;
}

const has = (assets: Asset[], type: Asset["type"], test: (a: Asset) => boolean = () => true) => assets.some((a) => a.type === type && !a.deletedAt && test(a));
const docRole = (role: string) => (a: Asset) => (a as Asset<"document">).data.role === role;

export const WORKFLOW: WorkflowStep[] = [
  { id: "import", label: "Import PLR", hint: "Bring the source product into the PLR Editor", href: "/editor", done: (a) => has(a, "document") },
  { id: "rights", label: "Review licence", hint: "Record what the licence allows", href: "/rights", done: (a) => has(a, "rights-review", (x) => !!(x as Asset<"rights-review">).data.reviewedAt) },
  { id: "rebrand", label: "Rebrand & edit", hint: "Make it yours and mark it approved", href: "/rebrand", done: (a) => has(a, "rebrand-session") || has(a, "document", docRole("rebrand")) || has(a, "document", (x) => x.status === "approved" || x.status === "ready") },
  { id: "cover", label: "Design a cover", hint: "Cover Creator", href: "/covers", done: (a) => has(a, "cover") },
  { id: "mockup", label: "Create a mockup", hint: "Mockup Studio", href: "/mockups", done: (a) => has(a, "mockup") },
  { id: "bonus", label: "Build a bonus", hint: "Bonus Builder", href: "/bonus-builder", done: (a) => has(a, "document", docRole("bonus")) },
  { id: "lead", label: "Create a lead magnet", hint: "Lead Magnet Creator", href: "/lead-magnets", done: (a) => has(a, "document", docRole("lead-magnet")) },
  { id: "sales", label: "Write the sales page", hint: "Sales Page Builder", href: "/sales-pages", done: (a) => has(a, "sales-page") },
  { id: "emails", label: "Write promo emails", hint: "Email Swipe Builder", href: "/emails", done: (a) => has(a, "email-campaign", (x) => (x as Asset<"email-campaign">).data.emails.length > 0) },
  { id: "funnel", label: "Design the funnel", hint: "Funnel Planner", href: "/funnels", done: (a) => has(a, "funnel", (x) => (x as Asset<"funnel">).data.nodes.length > 0) },
  { id: "profit", label: "Model the numbers", hint: "Profit Calculator", href: "/profit", done: (a) => has(a, "profit-scenario") },
  { id: "export", label: "Export the package", hint: "Export Centre", href: "/export", done: (_a, p) => !!p && p.stage === "launched" },
];

export function workflowStatus(assets: Asset[], project: Project, exportedPackage = false) {
  const steps = WORKFLOW.map((s) => ({ ...s, isDone: s.id === "export" ? exportedPackage || s.done(assets, project) : s.done(assets, project) }));
  const done = steps.filter((s) => s.isDone).length;
  return { steps, done, total: steps.length, next: steps.find((s) => !s.isDone) ?? null };
}
