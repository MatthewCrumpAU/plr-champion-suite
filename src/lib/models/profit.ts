/* ------------------------------------------------------------------ */
/* Profit Calculator                                                    */
/* ------------------------------------------------------------------ */
export interface ProfitScenario {
  id: string;
  name: string;
  /** Selling price per sale. */
  price: number;
  /** Payment processor percentage fee (e.g. 2.9). */
  feePercent: number;
  /** Payment processor fixed fee per sale (e.g. 0.30). */
  feeFixed: number;
  /** Affiliate commission percentage of price (0 if none). */
  affiliatePercent: number;
  /** Other variable cost per sale (delivery, licences, platform per-sale fees). */
  variableCost: number;
  /** Refund rate as a percentage of sales. */
  refundRate: number;
  /** Monthly advertising spend. */
  adSpend: number;
  /** Monthly fixed costs (software, hosting, membership platform). */
  fixedCosts: number;
  /** Monthly visitors to the sales page. */
  traffic: number;
  /** Visitor-to-buyer conversion rate (%). */
  conversionRate: number;
  /** When set, overrides traffic × conversion. */
  unitsOverride: number | null;
}

export interface ActualSale {
  id: string;
  date: string;
  units: number;
  grossRevenue: number;
  fees: number;
  refunds: number;
  adSpend: number;
  notes: string;
}

export interface ProfitData {
  currency: string;
  scenarios: ProfitScenario[];
  activeScenarioId: string | null;
  actuals: ActualSale[];
}

/* ------------------------------------------------------------------ */
/* Funnel Planner                                                       */
/* ------------------------------------------------------------------ */
export type FunnelOfferType = "lead-magnet" | "front-end" | "order-bump" | "upsell" | "downsell" | "membership" | "premium";

export const FUNNEL_OFFER_LABELS: Record<FunnelOfferType, string> = {
  "lead-magnet": "Free lead magnet",
  "front-end": "Front-end product",
  "order-bump": "Order bump",
  upsell: "Upsell",
  downsell: "Downsell",
  membership: "Membership",
  premium: "Premium offer",
};

export interface FunnelNodeData {
  label: string;
  offerType: FunnelOfferType;
  price: number;
  billing: "free" | "one-time" | "monthly" | "yearly";
  /** % of people arriving at this step who take the offer (opt-in rate, conversion or take rate). */
  conversionRate: number;
  /** For recurring offers: number of billing periods to count in the projection. */
  periods: number;
  assetId: string | null;
  notes: string;
  [key: string]: unknown;
}

export interface FunnelNode {
  id: string;
  type: "offer";
  position: { x: number; y: number };
  data: FunnelNodeData;
}

/** yes = buyers continue, no = non-buyers continue (downsell path), next = everyone who reached this step continues. */
export type FunnelEdgeKind = "yes" | "no" | "next";

export interface FunnelEdge {
  id: string;
  source: string;
  target: string;
  kind: FunnelEdgeKind;
}

export interface FunnelData {
  nodes: FunnelNode[];
  edges: FunnelEdge[];
  assumptions: { traffic: number; currency: string; adSpend: number };
  notes: string;
}

/* ------------------------------------------------------------------ */
/* Launch Planner                                                       */
/* ------------------------------------------------------------------ */
export type LaunchTaskCategory = "product" | "marketing" | "content" | "tech" | "admin" | "launch-day" | "post-launch";

export const LAUNCH_CATEGORY_LABELS: Record<LaunchTaskCategory, string> = {
  product: "Product",
  marketing: "Marketing",
  content: "Content",
  tech: "Tech & setup",
  admin: "Admin & legal",
  "launch-day": "Launch day",
  "post-launch": "Post-launch",
};

export type Priority = "low" | "medium" | "high" | "critical";
export type TaskStatus = "todo" | "doing" | "done" | "blocked";

export interface LaunchTask {
  id: string;
  title: string;
  category: LaunchTaskCategory;
  priority: Priority;
  status: TaskStatus;
  /** Days relative to launch date (negative = before). Used when dueDate is null. */
  offsetDays: number | null;
  dueDate: string | null;
  notes: string;
  milestoneId: string | null;
}

export interface LaunchMilestone {
  id: string;
  title: string;
  offsetDays: number | null;
  date: string | null;
  done: boolean;
}

export interface LaunchChecklistItem {
  id: string;
  label: string;
  done: boolean;
  /** Auto-check rule: the item ticks itself when the project contains a matching asset. */
  autoKey: string | null;
}

export interface LaunchPlanData {
  launchDate: string | null;
  tasks: LaunchTask[];
  milestones: LaunchMilestone[];
  readiness: LaunchChecklistItem[];
  marketing: LaunchChecklistItem[];
  notes: string;
  templateName: string | null;
}

export interface LaunchTemplate {
  id: string;
  name: string;
  description: string;
  builtIn: boolean;
  tasks: Omit<LaunchTask, "id" | "status" | "dueDate">[];
  milestones: Omit<LaunchMilestone, "id" | "done" | "date">[];
}
