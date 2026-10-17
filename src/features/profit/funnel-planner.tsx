"use client";

import * as React from "react";
import Link from "next/link";
import { Background, Controls, Handle, MarkerType, MiniMap, Position, ReactFlow, ReactFlowProvider, applyNodeChanges, useReactFlow, type Connection, type Edge, type EdgeChange, type Node, type NodeChange, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AlertTriangle, GitBranch, History, LayoutTemplate, Link2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/lib/data/types";
import type { FunnelData, FunnelEdgeKind, FunnelNodeData, FunnelOfferType } from "@/lib/models/profit";
import { FUNNEL_OFFER_LABELS } from "@/lib/models/profit";
import { FUNNEL_TEMPLATES, OFFER_COLORS, edgeLabel, funnelReport, newFunnelNode, projectFunnel, type FunnelProjection, type NodeProjection } from "@/lib/profit/funnel";
import { money } from "@/lib/profit/calc";
import { useAssets } from "@/lib/data/hooks";
import { assetHref } from "@/lib/data/asset-types";
import { createAsset } from "@/lib/services/assets";
import { safeFileName, textFile } from "@/lib/export/download";
import { Button } from "@/components/ui/button";
import { Badge, Callout, Field, Input, NativeSelect, Textarea } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { useConfirm } from "@/components/ui/confirm";
import { AssetWorkspace } from "@/components/common/asset-workspace";
import { ExportMenu } from "@/components/common/export-menu";
import type { AssetEditor } from "@/features/common/use-asset-editor";
import { cn, uid } from "@/lib/utils";

type OfferNodeData = FunnelNodeData & { projection?: NodeProjection; currency: string; linkedTitle?: string | null };
type OfferRFNode = Node<OfferNodeData, "offer">;

const fmt = (v: number) => (v >= 100 ? Math.round(v).toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 1 }));
const EDGE_STYLE: Record<FunnelEdgeKind, { stroke: string; dash?: string }> = { yes: { stroke: "#0ca30c" }, no: { stroke: "#898781", dash: "6 4" }, next: { stroke: "#2a78d6" } };

function OfferNode({ data, selected }: NodeProps<OfferRFNode>) {
  const color = OFFER_COLORS[data.offerType];
  const p = data.projection;
  const priceText = data.billing === "free" || data.price <= 0 ? "Free" : `${money(data.price, data.currency)}${data.billing === "monthly" ? "/mo" : data.billing === "yearly" ? "/yr" : ""}`;
  return (
    <div className={cn("w-[220px] overflow-hidden rounded-xl border bg-white shadow-sm transition", selected ? "border-primary ring-2 ring-primary/30" : "border-border")} data-testid="funnel-node">
      <div className="h-1.5" style={{ background: color }} />
      <Handle type="target" position={Position.Left} className="!size-3 !border-2 !border-white !bg-[#52514e]" />
      <div className="grid gap-1 px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "#52514e" }}>
            {FUNNEL_OFFER_LABELS[data.offerType]}
          </span>
          <span className="ml-auto text-[12px] font-semibold tabular-nums">{priceText}</span>
        </div>
        <p className="line-clamp-2 text-[13.5px] font-semibold leading-snug">{data.label}</p>
        <p className="text-[11px] text-muted-foreground">
          {data.conversionRate}% {data.offerType === "lead-magnet" ? "opt in" : "take it"}
          {(data.billing === "monthly" || data.billing === "yearly") && ` · ${data.periods} ${data.billing === "monthly" ? "months" : "years"}`}
        </p>
        {data.linkedTitle && (
          <p className="flex items-center gap-1 truncate text-[10.5px] text-primary">
            <Link2 className="size-3" /> {data.linkedTitle}
          </p>
        )}
        {p && (
          <div className="mt-1 grid grid-cols-3 gap-1 rounded-md bg-secondary/70 px-1.5 py-1 text-center text-[10.5px]">
            <span>
              <b className="block tabular-nums">{fmt(p.arrivals)}</b>reach
            </span>
            <span>
              <b className="block tabular-nums">{fmt(p.takers)}</b>
              {data.offerType === "lead-magnet" ? "leads" : "buyers"}
            </span>
            <span>
              <b className="block tabular-nums">{money(p.revenue, data.currency, 0)}</b>revenue
            </span>
          </div>
        )}
      </div>
      <Handle id="yes" type="source" position={Position.Right} className="!size-3 !border-2 !border-white !bg-[#0ca30c]" title="Buyers / opt-ins continue" />
      <Handle id="no" type="source" position={Position.Bottom} className="!size-3 !border-2 !border-white !bg-[#898781]" title="People who declined continue" />
    </div>
  );
}

const nodeTypes = { offer: OfferNode };

function Canvas({ d, editor, projection, selection, setSelection, currency, assets }: { d: FunnelData; editor: AssetEditor<"funnel">; projection: FunnelProjection; selection: { kind: "node" | "edge"; id: string } | null; setSelection: (s: { kind: "node" | "edge"; id: string } | null) => void; currency: string; assets: { id: string; title: string; type: string }[] }) {
  const titles = React.useMemo(() => new Map(assets.map((a) => [a.id, a.title])), [assets]);
  // Local React Flow node state keeps measured sizes and drag state; the asset data stays the source of truth.
  const [nodes, setNodes] = React.useState<OfferRFNode[]>([]);
  React.useEffect(() => {
    setNodes((prev) => {
      const prevById = new Map(prev.map((n) => [n.id, n]));
      return d.nodes.map((n) => {
        const p = prevById.get(n.id);
        const data: OfferNodeData = { ...n.data, projection: projection.nodes[n.id], currency, linkedTitle: n.data.assetId ? (titles.get(n.data.assetId) ?? null) : null };
        const selected = selection?.kind === "node" && selection.id === n.id;
        return p ? { ...p, position: p.dragging ? p.position : n.position, data, selected } : { id: n.id, type: "offer", position: n.position, data, selected };
      });
    });
  }, [d.nodes, projection, selection, currency, titles]);
  const typeById = React.useMemo(() => new Map(d.nodes.map((n) => [n.id, n.data.offerType])), [d.nodes]);
  const edges: Edge[] = React.useMemo(
    () =>
      d.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.kind === "no" ? "no" : "yes",
        label: edgeLabel(e.kind, typeById.get(e.source)),
        selected: selection?.kind === "edge" && selection.id === e.id,
        style: { stroke: EDGE_STYLE[e.kind].stroke, strokeWidth: 2, strokeDasharray: EDGE_STYLE[e.kind].dash },
        markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_STYLE[e.kind].stroke },
        labelStyle: { fontSize: 11, fill: "#52514e", fontWeight: 600 },
        labelBgStyle: { fill: "#ffffff" },
        labelBgPadding: [4, 2] as [number, number],
      })),
    [d.edges, selection, typeById],
  );

  const onNodesChange = (changes: NodeChange<OfferRFNode>[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
    const sel = changes.find((c) => c.type === "select" && c.selected) as { id: string } | undefined;
    if (sel) setSelection({ kind: "node", id: sel.id });
    const removed = new Set(changes.filter((c) => c.type === "remove").map((c) => (c as { id: string }).id));
    if (removed.size) {
      editor.update((x) => ({ ...x, nodes: x.nodes.filter((n) => !removed.has(n.id)), edges: x.edges.filter((e) => !removed.has(e.source) && !removed.has(e.target)) }));
      if (selection && removed.has(selection.id)) setSelection(null);
    }
  };
  const onNodeDragStop = (_: unknown, __: unknown, dragged: OfferRFNode[]) => {
    const pos = new Map(dragged.map((n) => [n.id, { x: Math.round(n.position.x), y: Math.round(n.position.y) }]));
    editor.update((x) => ({ ...x, nodes: x.nodes.map((n) => (pos.has(n.id) ? { ...n, position: pos.get(n.id)! } : n)) }));
  };
  const onEdgesChange = (changes: EdgeChange[]) => {
    const sel = changes.find((c) => c.type === "select" && c.selected) as { id: string } | undefined;
    if (sel) setSelection({ kind: "edge", id: sel.id });
    const removed = changes.filter((c) => c.type === "remove").map((c) => (c as { id: string }).id);
    if (removed.length) {
      editor.update((x) => ({ ...x, edges: x.edges.filter((e) => !removed.includes(e.id)) }));
    }
  };
  const onConnect = (c: Connection) => {
    if (!c.source || !c.target || c.source === c.target) return;
    const kind: FunnelEdgeKind = c.sourceHandle === "no" ? "no" : "yes";
    if (d.edges.some((e) => e.source === c.source && e.target === c.target)) return toast.message("Those steps are already connected.");
    editor.update((x) => ({ ...x, edges: [...x.edges, { id: uid("fe"), source: c.source!, target: c.target!, kind }] }));
  };

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onNodeDragStop={onNodeDragStop}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onPaneClick={() => setSelection(null)}
      fitView
      fitViewOptions={{ padding: 0.25, maxZoom: 1.1 }}
      minZoom={0.2}
      maxZoom={1.8}
      deleteKeyCode={["Delete", "Backspace"]}
      proOptions={{ hideAttribution: true }}
      data-testid="funnel-canvas"
    >
      <Background gap={20} size={1} color="#d9dbe3" />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable nodeColor={(n) => OFFER_COLORS[(n.data as OfferNodeData).offerType]} maskColor="rgba(246,247,249,0.7)" />
    </ReactFlow>
  );
}

function AddOfferButtons({ onAdd }: { onAdd: (t: FunnelOfferType) => void }) {
  return (
    <div className="grid gap-1.5" data-testid="funnel-palette">
      {(Object.keys(FUNNEL_OFFER_LABELS) as FunnelOfferType[]).map((t) => (
        <button key={t} type="button" onClick={() => onAdd(t)} className="flex items-center gap-2 rounded-lg border bg-card px-2.5 py-2 text-left text-[13px] hover:border-primary/50 hover:bg-secondary" data-testid={`add-${t}`}>
          <span className="size-2.5 rounded-full" style={{ background: OFFER_COLORS[t] }} />
          {FUNNEL_OFFER_LABELS[t]}
        </button>
      ))}
    </div>
  );
}

function FunnelEditorInner({ editor, project }: { editor: AssetEditor<"funnel">; project: Project }) {
  const d = editor.data!;
  const [selection, setSelection] = React.useState<{ kind: "node" | "edge"; id: string } | null>(null);
  const [tplOpen, setTplOpen] = React.useState(false);
  const [versionName, setVersionName] = React.useState("");
  const rf = useReactFlow();
  const confirm = useConfirm();
  const { data: allAssets } = useAssets(project.id, ["document", "sales-page", "email-campaign", "cover"]);
  const assets = (allAssets ?? []).map((a) => ({ id: a.id, title: a.title, type: a.type }));
  const projection = React.useMemo(() => projectFunnel(d), [d]);
  const currency = d.assumptions.currency || "USD";
  const node = selection?.kind === "node" ? d.nodes.find((n) => n.id === selection.id) : null;
  const edgeSel = selection?.kind === "edge" ? d.edges.find((e) => e.id === selection.id) : null;
  const patchNode = (id: string, p: Partial<FunnelNodeData>) => editor.update((x) => ({ ...x, nodes: x.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...p } } : n)) }));

  const add = (t: FunnelOfferType) => {
    // Place new steps to the right of the existing map so they never land on top of another step.
    let pos = { x: 0, y: 0 };
    if (d.nodes.length) {
      const maxX = Math.max(...d.nodes.map((n) => n.position.x));
      const ys = d.nodes.filter((n) => n.position.x >= maxX - 40).map((n) => n.position.y);
      pos = { x: maxX + 300, y: Math.max(...ys) + (ys.length > 1 ? 0 : 160) };
    }
    const n = newFunnelNode(t, pos);
    editor.update((x) => ({ ...x, nodes: [...x.nodes, n] }));
    setSelection({ kind: "node", id: n.id });
    setTimeout(() => rf.fitView({ padding: 0.25, maxZoom: 1.1, duration: 250 }), 60);
  };

  const applyTemplate = async (id: string) => {
    const tpl = FUNNEL_TEMPLATES.find((t) => t.id === id)!;
    if (d.nodes.length && !(await confirm({ title: `Replace this funnel with “${tpl.name}”?`, description: "The current steps are saved in version history first.", confirmLabel: "Replace" }))) return;
    if (d.nodes.length) await editor.snapshot("Before applying a funnel template", "pre-apply");
    const main = assets.find((a) => a.type === "document");
    editor.update((x) => ({ ...x, ...tpl.build({ product: main?.title ?? project.name.replace(/^SAMPLE\s*[—-]\s*/i, "") }) }));
    setTplOpen(false);
    setSelection(null);
    setTimeout(() => rf.fitView({ padding: 0.25, maxZoom: 1.1 }), 50);
  };

  return (
    <div className="flex min-h-full flex-col lg:h-full lg:min-h-0 lg:flex-row">
      <aside className="plr-scroll order-3 flex w-full shrink-0 flex-col gap-3 border-t bg-card p-3 lg:order-none lg:w-[210px] lg:overflow-y-auto lg:border-t-0 lg:border-r">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Add a step</p>
        <AddOfferButtons onAdd={add} />
        <Button size="sm" variant="outline" onClick={() => setTplOpen(true)} data-testid="funnel-templates">
          <LayoutTemplate /> Templates
        </Button>
        <div className="mt-2 grid gap-1.5 rounded-lg bg-secondary/60 p-2.5 text-[11.5px] leading-snug text-muted-foreground">
          <p className="font-medium text-foreground">Connecting steps</p>
          <p>
            <span className="mr-1 inline-block size-2 rounded-full bg-[#0ca30c]" />
            Right handle: people who <b>bought / opted in</b> continue.
          </p>
          <p>
            <span className="mr-1 inline-block size-2 rounded-full bg-[#898781]" />
            Bottom handle: people who <b>declined</b> continue (downsells).
          </p>
          <p>Select a connection to change it to “everyone continues”. Press Delete to remove a selected step or connection.</p>
        </div>
      </aside>
      <section className="relative order-1 h-[62dvh] min-w-0 shrink-0 bg-[#f6f7f9] lg:order-none lg:h-auto lg:flex-1 lg:shrink">
        {d.nodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div className="pointer-events-auto grid max-w-sm gap-2 rounded-xl border bg-card p-5 text-center shadow-sm">
              <GitBranch className="mx-auto size-6 text-primary" />
              <p className="font-semibold">Map your funnel</p>
              <p className="text-sm text-muted-foreground">Start from a template or add steps from the left, then connect them.</p>
              <Button size="sm" onClick={() => setTplOpen(true)}>
                <LayoutTemplate /> Choose a template
              </Button>
            </div>
          </div>
        )}
        <Canvas d={d} editor={editor} projection={projection} selection={selection} setSelection={setSelection} currency={currency} assets={assets} />
      </section>
      <aside className="plr-scroll order-2 w-full shrink-0 border-t bg-card p-4 lg:order-none lg:w-[320px] lg:overflow-y-auto lg:border-t-0 lg:border-l">
        {node ? (
          <div className="grid gap-3" data-testid="funnel-node-editor">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full" style={{ background: OFFER_COLORS[node.data.offerType] }} />
              <p className="text-sm font-semibold">Step settings</p>
              <Button size="icon-xs" variant="ghost" className="ml-auto" aria-label="Delete step" onClick={() => { editor.update((x) => ({ ...x, nodes: x.nodes.filter((n) => n.id !== node.id), edges: x.edges.filter((e) => e.source !== node.id && e.target !== node.id) })); setSelection(null); }}>
                <Trash2 />
              </Button>
            </div>
            <Field label="Name">
              <Input value={node.data.label} onChange={(e) => patchNode(node.id, { label: e.target.value })} data-testid="node-label" />
            </Field>
            <Field label="Step type">
              <NativeSelect value={node.data.offerType} onChange={(e) => patchNode(node.id, { offerType: e.target.value as FunnelOfferType })}>
                {Object.entries(FUNNEL_OFFER_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Price">
                <Input type="number" min={0} step="0.01" value={node.data.price} onChange={(e) => patchNode(node.id, { price: Math.max(0, Number(e.target.value) || 0) })} data-testid="node-price" />
              </Field>
              <Field label="Billing">
                <NativeSelect value={node.data.billing} onChange={(e) => patchNode(node.id, { billing: e.target.value as FunnelNodeData["billing"] })}>
                  <option value="free">Free</option>
                  <option value="one-time">One-time</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </NativeSelect>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label={node.data.offerType === "lead-magnet" ? "Opt-in rate %" : "Take rate %"} hint="Your assumption">
                <Input type="number" min={0} max={100} step="0.1" value={node.data.conversionRate} onChange={(e) => patchNode(node.id, { conversionRate: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} data-testid="node-conv" />
              </Field>
              {(node.data.billing === "monthly" || node.data.billing === "yearly") && (
                <Field label={node.data.billing === "monthly" ? "Months counted" : "Years counted"} hint="Average retention">
                  <Input type="number" min={1} max={60} value={node.data.periods} onChange={(e) => patchNode(node.id, { periods: Math.max(1, Math.round(Number(e.target.value) || 1)) })} />
                </Field>
              )}
            </div>
            <Field label="Linked product or asset" optional>
              <NativeSelect value={node.data.assetId ?? ""} onChange={(e) => patchNode(node.id, { assetId: e.target.value || null })}>
                <option value="">None</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {node.data.assetId && assets.find((a) => a.id === node.data.assetId) && (
              <Link href={assetHref(assets.find((a) => a.id === node.data.assetId) as never)} className="-mt-1 flex items-center gap-1 text-xs font-medium text-primary">
                <Link2 className="size-3" /> Open linked asset
              </Link>
            )}
            <Field label="Notes" optional>
              <Textarea rows={3} value={node.data.notes} onChange={(e) => patchNode(node.id, { notes: e.target.value })} />
            </Field>
            {projection.nodes[node.id] && (
              <div className="rounded-lg bg-secondary/60 p-3 text-[12.5px]">
                <p className="mb-1 font-medium">Projection for this step</p>
                <p>
                  {fmt(projection.nodes[node.id].arrivals)} reach it → {fmt(projection.nodes[node.id].takers)} {node.data.offerType === "lead-magnet" ? "opt in" : "buy"} → {money(projection.nodes[node.id].revenue, currency)}
                </p>
              </div>
            )}
          </div>
        ) : edgeSel ? (
          <div className="grid gap-3" data-testid="funnel-edge-editor">
            <p className="text-sm font-semibold">Connection</p>
            <Field label="Who continues along this path?">
              <NativeSelect value={edgeSel.kind} onChange={(e) => editor.update((x) => ({ ...x, edges: x.edges.map((y) => (y.id === edgeSel.id ? { ...y, kind: e.target.value as FunnelEdgeKind } : y)) }))} data-testid="edge-kind">
                <option value="yes">People who bought / opted in</option>
                <option value="no">People who declined</option>
                <option value="next">Everyone who reached the step</option>
              </NativeSelect>
            </Field>
            <Button size="sm" variant="ghost" className="justify-self-start text-destructive" onClick={() => { editor.update((x) => ({ ...x, edges: x.edges.filter((y) => y.id !== edgeSel.id) })); setSelection(null); }}>
              <Trash2 /> Remove connection
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-3">
              <p className="text-sm font-semibold">Assumptions</p>
              <Field label="Visitors entering the funnel" hint="Per month, or per launch — your choice; results use the same period.">
                <Input type="number" min={0} value={d.assumptions.traffic} onChange={(e) => editor.update((x) => ({ ...x, assumptions: { ...x.assumptions, traffic: Math.max(0, Number(e.target.value) || 0) } }))} data-testid="funnel-traffic" />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Ad spend">
                  <Input type="number" min={0} value={d.assumptions.adSpend} onChange={(e) => editor.update((x) => ({ ...x, assumptions: { ...x.assumptions, adSpend: Math.max(0, Number(e.target.value) || 0) } }))} />
                </Field>
                <Field label="Currency">
                  <NativeSelect value={currency} onChange={(e) => editor.update((x) => ({ ...x, assumptions: { ...x.assumptions, currency: e.target.value } }))}>
                    {["USD", "AUD", "GBP", "EUR", "CAD", "NZD"].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
            </div>
            <div className="grid gap-2 rounded-xl border p-3" data-testid="funnel-projection">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">Hypothetical revenue</p>
                <Badge variant="estimate" className="ml-auto">
                  Projection
                </Badge>
              </div>
              <p className="text-2xl font-semibold tabular-nums" data-testid="funnel-total">
                {money(projection.totalRevenue, currency)}
              </p>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12.5px]">
                <dt className="text-muted-foreground">One-time sales</dt>
                <dd className="text-right tabular-nums">{money(projection.oneTimeRevenue, currency)}</dd>
                <dt className="text-muted-foreground">Recurring (counted periods)</dt>
                <dd className="text-right tabular-nums">{money(projection.recurringRevenue, currency)}</dd>
                <dt className="text-muted-foreground">Leads</dt>
                <dd className="text-right tabular-nums">{fmt(projection.leads)}</dd>
                <dt className="text-muted-foreground">Front-end buyers</dt>
                <dd className="text-right tabular-nums">{fmt(projection.firstPurchases)}</dd>
                <dt className="text-muted-foreground">Revenue per visitor</dt>
                <dd className="text-right tabular-nums">{money(projection.revenuePerVisitor, currency)}</dd>
                <dt className="text-muted-foreground">After ad spend</dt>
                <dd className={cn("text-right font-medium tabular-nums", projection.profitBeforeCosts < 0 && "text-[#d03b3b]")}>{money(projection.profitBeforeCosts, currency)}</dd>
              </dl>
              <p className="text-[11px] leading-snug text-muted-foreground">A what-if model from your traffic and conversion assumptions. It is not a forecast or guaranteed earnings, and excludes fees, refunds and other costs (use the Profit Calculator for those).</p>
            </div>
            {projection.warnings.length > 0 && (
              <Callout tone="warning" icon={<AlertTriangle />}>
                <ul className="grid gap-1 text-[12px]">
                  {projection.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </Callout>
            )}
            <div className="grid gap-2 rounded-xl border p-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <History className="size-4" /> Save a version
              </p>
              <div className="flex gap-2">
                <Input value={versionName} onChange={(e) => setVersionName(e.target.value)} placeholder="e.g. Before price test" className="h-8 text-xs" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await editor.snapshot(versionName.trim() || `Funnel version ${new Date().toLocaleString()}`, "manual");
                    setVersionName("");
                    toast.success("Version saved — find it under version history");
                  }}
                  data-testid="funnel-save-version"
                >
                  <Save /> Save
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">Compare and restore versions from the history button in the header.</p>
            </div>
            <Field label="Funnel notes" optional>
              <Textarea rows={3} value={d.notes} onChange={(e) => editor.update((x) => ({ ...x, notes: e.target.value }))} />
            </Field>
          </div>
        )}
      </aside>
      <Dialog open={tplOpen} onOpenChange={setTplOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Funnel templates</DialogTitle>
            <DialogDescription>Starting points with typical take rates you should replace with your own assumptions.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {FUNNEL_TEMPLATES.map((t) => (
              <button key={t.id} type="button" onClick={() => void applyTemplate(t.id)} className="rounded-lg border p-3 text-left hover:border-primary hover:bg-primary-soft/40" data-testid={`funnel-template-${t.id}`}>
                <p className="font-semibold">{t.name}</p>
                <p className="text-sm text-muted-foreground">{t.description}</p>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTplOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function FunnelPlanner({ project }: { project: Project }) {
  return (
    <AssetWorkspace
      project={project}
      type="funnel"
      tool="Funnel Planner"
      eyebrow="Profit Studio"
      icon={<GitBranch />}
      description="Design your funnel on a drag-and-drop canvas — lead magnet, front-end, order bump, upsell, downsell, membership and premium offers — and see hypothetical revenue from your own traffic and conversion assumptions."
      createLabel="New funnel"
      onCreate={async () => (await createAsset(project.id, "funnel", { title: `${project.name.replace(/^SAMPLE\s*[—-]\s*/i, "")} funnel`, data: { assumptions: { traffic: 1000, currency: project.currency || "USD", adSpend: 0 } } })).id}
      itemMeta={(a) => `${a.data.nodes.length} steps · ${money(projectFunnel(a.data).totalRevenue, a.data.assumptions.currency || "USD")} hypothetical`}
      fullHeight
      renderEditor={(editor) => (
        <ReactFlowProvider>
          <FunnelEditorInner editor={editor} project={project} />
        </ReactFlowProvider>
      )}
      versionText={(x) => funnelReport(x as FunnelData, "Version")}
      headerActions={(editor) => (
        <ExportMenu
          projectId={project.id}
          assetId={editor.asset!.id}
          assetLabel={editor.title}
          beforeExport={editor.save}
          options={[
            { id: "md", label: "Funnel summary (Markdown)", run: () => textFile(funnelReport(editor.getData()!, editor.title), safeFileName(editor.title, "md"), "text/markdown") },
            { id: "json", label: "Funnel map (JSON)", run: () => textFile(JSON.stringify(editor.getData(), null, 2), safeFileName(editor.title, "json"), "application/json") },
          ]}
        />
      )}
    />
  );
}
