import type { FunnelData, FunnelEdge, FunnelEdgeKind, FunnelNode, FunnelNodeData, FunnelOfferType } from "@/lib/models/profit";
import { uid } from "@/lib/utils";
import { FUNNEL_OFFER_LABELS } from "@/lib/models/profit";
import { money } from "./calc";

/**
 * Hypothetical funnel projection. Visitors enter at the starting step(s) and flow along connections:
 * "yes" carries the people who took the offer, "no" the people who declined, "next" everyone who reached the step.
 * Every number comes from the user's own traffic and conversion assumptions — it is a what-if model, not a forecast.
 */
export interface NodeProjection {
  arrivals: number;
  takers: number;
  decliners: number;
  revenue: number;
  reachable: boolean;
}

export interface FunnelProjection {
  nodes: Record<string, NodeProjection>;
  totalRevenue: number;
  oneTimeRevenue: number;
  recurringRevenue: number;
  leads: number;
  firstPurchases: number;
  adSpend: number;
  profitBeforeCosts: number;
  revenuePerVisitor: number;
  entryIds: string[];
  warnings: string[];
}

export const OFFER_DEFAULTS: Record<FunnelOfferType, Pick<FunnelNodeData, "offerType" | "price" | "billing" | "conversionRate" | "periods">> = {
  "lead-magnet": { offerType: "lead-magnet", price: 0, billing: "free", conversionRate: 35, periods: 1 },
  "front-end": { offerType: "front-end", price: 17, billing: "one-time", conversionRate: 2, periods: 1 },
  "order-bump": { offerType: "order-bump", price: 9, billing: "one-time", conversionRate: 25, periods: 1 },
  upsell: { offerType: "upsell", price: 47, billing: "one-time", conversionRate: 10, periods: 1 },
  downsell: { offerType: "downsell", price: 27, billing: "one-time", conversionRate: 8, periods: 1 },
  membership: { offerType: "membership", price: 19, billing: "monthly", conversionRate: 5, periods: 3 },
  premium: { offerType: "premium", price: 197, billing: "one-time", conversionRate: 2, periods: 1 },
};

export const OFFER_COLORS: Record<FunnelOfferType, string> = {
  "lead-magnet": "#1baf7a",
  "front-end": "#2a78d6",
  "order-bump": "#eda100",
  upsell: "#6250d6",
  downsell: "#e87ba4",
  membership: "#eb6834",
  premium: "#0b1122",
};

export function edgeLabel(kind: FunnelEdgeKind, sourceType: FunnelOfferType | undefined): string {
  if (kind === "next") return "Everyone";
  if (kind === "no") return sourceType === "lead-magnet" ? "Didn't opt in" : "Declined";
  return sourceType === "lead-magnet" ? "Opted in" : "Bought";
}

const revenueMultiplier = (d: FunnelNodeData) => (d.billing === "free" ? 0 : d.billing === "one-time" ? 1 : Math.max(1, Math.round(d.periods || 1)));

export function projectFunnel(data: FunnelData): FunnelProjection {
  const { nodes, edges } = data;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const validEdges = edges.filter((e) => byId.has(e.source) && byId.has(e.target) && e.source !== e.target);
  const incoming = new Map<string, FunnelEdge[]>();
  const outgoing = new Map<string, FunnelEdge[]>();
  for (const e of validEdges) {
    incoming.set(e.target, [...(incoming.get(e.target) ?? []), e]);
    outgoing.set(e.source, [...(outgoing.get(e.source) ?? []), e]);
  }
  const warnings: string[] = [];
  const entryIds = nodes.filter((n) => !incoming.get(n.id)?.length).sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y).map((n) => n.id);
  if (entryIds.length > 1) warnings.push(`${entryIds.length} steps have no incoming connection, so traffic is split evenly between them. Connect the steps to model a single path.`);

  // Kahn topological order; anything left over is part of a cycle.
  const indeg = new Map(nodes.map((n) => [n.id, incoming.get(n.id)?.length ?? 0]));
  const queue = [...entryIds];
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const e of outgoing.get(id) ?? []) {
      indeg.set(e.target, (indeg.get(e.target) ?? 0) - 1);
      if (indeg.get(e.target) === 0) queue.push(e.target);
    }
  }
  if (order.length < nodes.length) warnings.push("Some connections form a loop. Steps in the loop are left out of the projection.");

  const traffic = Math.max(0, Number(data.assumptions.traffic) || 0);
  const arrivals = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  for (const id of entryIds) arrivals.set(id, traffic / Math.max(1, entryIds.length));
  const result: Record<string, NodeProjection> = {};
  for (const n of nodes) result[n.id] = { arrivals: 0, takers: 0, decliners: 0, revenue: 0, reachable: false };

  for (const id of order) {
    const node = byId.get(id)!;
    const a = arrivals.get(id) ?? 0;
    const rate = Math.min(100, Math.max(0, Number(node.data.conversionRate) || 0)) / 100;
    const takers = a * rate;
    const decliners = a - takers;
    const revenue = takers * Math.max(0, Number(node.data.price) || 0) * revenueMultiplier(node.data);
    result[id] = { arrivals: a, takers, decliners, revenue, reachable: a > 0 || entryIds.includes(id) };
    for (const e of outgoing.get(id) ?? []) {
      const flow = e.kind === "yes" ? takers : e.kind === "no" ? decliners : a;
      arrivals.set(e.target, (arrivals.get(e.target) ?? 0) + flow);
    }
  }

  let oneTime = 0;
  let recurring = 0;
  let leads = 0;
  let firstPurchases = 0;
  for (const n of nodes) {
    const r = result[n.id];
    if (n.data.billing === "monthly" || n.data.billing === "yearly") recurring += r.revenue;
    else oneTime += r.revenue;
    if (n.data.offerType === "lead-magnet") leads += r.takers;
    if (n.data.offerType === "front-end") firstPurchases += r.takers;
    if (!r.reachable && nodes.length > 1) warnings.push(`“${n.data.label}” receives no visitors — connect it to an earlier step.`);
  }
  const totalRevenue = oneTime + recurring;
  const adSpend = Math.max(0, Number(data.assumptions.adSpend) || 0);
  return { nodes: result, totalRevenue, oneTimeRevenue: oneTime, recurringRevenue: recurring, leads, firstPurchases, adSpend, profitBeforeCosts: totalRevenue - adSpend, revenuePerVisitor: traffic > 0 ? totalRevenue / traffic : 0, entryIds, warnings: [...new Set(warnings)] };
}

export function newFunnelNode(type: FunnelOfferType, position: { x: number; y: number }, label?: string): FunnelNode {
  const def = OFFER_DEFAULTS[type];
  return { id: uid("fn"), type: "offer", position, data: { label: label ?? defaultLabel(type), assetId: null, notes: "", ...def } };
}

function defaultLabel(t: FunnelOfferType): string {
  return { "lead-magnet": "Free checklist", "front-end": "Main ebook", "order-bump": "Order bump", upsell: "Upsell", downsell: "Downsell", membership: "Membership", premium: "Premium offer" }[t];
}

export const FUNNEL_TEMPLATES: { id: string; name: string; description: string; build: (names: { product: string }) => Pick<FunnelData, "nodes" | "edges"> }[] = [
  {
    id: "simple",
    name: "Simple sales funnel",
    description: "Front-end product with an order bump and one upsell, plus a downsell for people who decline.",
    build: ({ product }) => {
      const fe = newFunnelNode("front-end", { x: 0, y: 120 }, product);
      const ob = newFunnelNode("order-bump", { x: 320, y: 0 });
      const up = newFunnelNode("upsell", { x: 320, y: 240 });
      const dn = newFunnelNode("downsell", { x: 640, y: 360 });
      return { nodes: [fe, ob, up, dn], edges: [edge(fe.id, ob.id, "yes"), edge(fe.id, up.id, "yes"), edge(up.id, dn.id, "no")] };
    },
  },
  {
    id: "lead",
    name: "Lead magnet funnel",
    description: "Free opt-in leads to a low-priced front-end offer with a bump and an upsell.",
    build: ({ product }) => {
      const lm = newFunnelNode("lead-magnet", { x: 0, y: 120 });
      const fe = newFunnelNode("front-end", { x: 320, y: 120 }, product);
      const ob = newFunnelNode("order-bump", { x: 640, y: 0 });
      const up = newFunnelNode("upsell", { x: 640, y: 240 });
      fe.data.conversionRate = 5;
      return { nodes: [lm, fe, ob, up], edges: [edge(lm.id, fe.id, "yes"), edge(fe.id, ob.id, "yes"), edge(fe.id, up.id, "yes")] };
    },
  },
  {
    id: "ladder",
    name: "Full value ladder",
    description: "Lead magnet → front-end → bump → upsell/downsell → membership and a premium offer.",
    build: ({ product }) => {
      const lm = newFunnelNode("lead-magnet", { x: 0, y: 160 });
      const fe = newFunnelNode("front-end", { x: 300, y: 160 }, product);
      const ob = newFunnelNode("order-bump", { x: 600, y: 0 });
      const up = newFunnelNode("upsell", { x: 600, y: 200 });
      const dn = newFunnelNode("downsell", { x: 900, y: 340 });
      const mem = newFunnelNode("membership", { x: 900, y: 120 });
      const pr = newFunnelNode("premium", { x: 1200, y: 120 });
      fe.data.conversionRate = 5;
      return { nodes: [lm, fe, ob, up, dn, mem, pr], edges: [edge(lm.id, fe.id, "yes"), edge(fe.id, ob.id, "yes"), edge(fe.id, up.id, "yes"), edge(up.id, dn.id, "no"), edge(up.id, mem.id, "next"), edge(mem.id, pr.id, "yes")] };
    },
  },
];

export function edge(source: string, target: string, kind: FunnelEdgeKind): FunnelEdge {
  return { id: uid("fe"), source, target, kind };
}

const fmtN = (v: number) => (v >= 100 ? Math.round(v).toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 1 }));

export function funnelReport(d: FunnelData, title: string): string {
  const p = projectFunnel(d);
  const c = d.assumptions.currency || "USD";
  const lines = [`# ${title}`, "", "_Hypothetical projection from your own traffic and conversion assumptions — not a forecast or guaranteed earnings._", "", `Visitors: ${d.assumptions.traffic} · Ad spend: ${money(d.assumptions.adSpend, c)}`, "", "| Step | Type | Price | Rate | Reach | Takers | Revenue |", "| --- | --- | ---: | ---: | ---: | ---: | ---: |"];
  for (const n of d.nodes) {
    const x = p.nodes[n.id];
    lines.push(`| ${n.data.label} | ${FUNNEL_OFFER_LABELS[n.data.offerType]} | ${n.data.billing === "free" ? "Free" : money(n.data.price, c)}${n.data.billing === "monthly" ? "/mo" : n.data.billing === "yearly" ? "/yr" : ""} | ${n.data.conversionRate}% | ${fmtN(x.arrivals)} | ${fmtN(x.takers)} | ${money(x.revenue, c)} |`);
  }
  lines.push("", `**Total hypothetical revenue:** ${money(p.totalRevenue, c)} (after ad spend ${money(p.profitBeforeCosts, c)})`, "");
  const label = new Map(d.nodes.map((n) => [n.id, n.data.label]));
  if (d.edges.length) {
    lines.push("## Paths", "");
    for (const e of d.edges) lines.push(`- ${label.get(e.source)} → ${label.get(e.target)} (${e.kind === "yes" ? "buyers / opt-ins" : e.kind === "no" ? "decliners" : "everyone"})`);
  }
  if (d.notes) lines.push("", "## Notes", "", d.notes);
  return lines.join("\n");
}

