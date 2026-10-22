/**
 * BYLDITY integration interfaces (prepared, not connected).
 *
 * PLR Champion, PLRforIM and PLR Profit Lab will later hand work to the BYLDITY apps — campaign
 * emails to ByldSend, sales and opt-in pages to ByldPages, launch timers to Byld Countdown and
 * buyer automations to ByldFlow. This module fixes the payload shapes and the connector contract
 * now, so the UI can show exactly what would be sent and a real connector can be dropped in later
 * without touching the screens. Nothing here makes network calls.
 */
import type { CampaignDrop } from "@/lib/lab/types";
import { campaignLaunchDate, campaignSalesPageData, entryDate } from "@/lib/lab/campaigns";
import { salesPageHtml } from "@/lib/marketing/sales";

export type ByldityAppId = "byldsend" | "byldpages" | "byld-countdown" | "byldflow";

export interface ByldityApp {
  id: ByldityAppId;
  name: string;
  purpose: string;
}

export const BYLDITY_APPS: ByldityApp[] = [
  { id: "byldsend", name: "ByldSend", purpose: "Email sequences and broadcasts" },
  { id: "byldpages", name: "ByldPages", purpose: "Sales and opt-in pages" },
  { id: "byld-countdown", name: "Byld Countdown", purpose: "Launch countdown timers" },
  { id: "byldflow", name: "ByldFlow", purpose: "Automations such as tagging buyers and follow-ups" },
];

export interface EmailSequencePayload {
  kind: "email-sequence";
  name: string;
  /** Local launch date the day offsets are relative to. */
  launchDate: string;
  emails: { sendOn: string; dayOffset: number; subject: string; preview: string; body: string; ctaText: string; ctaUrl: string }[];
}

export interface PagePayload {
  kind: "page";
  name: string;
  slug: string;
  html: string;
}

export interface CountdownPayload {
  kind: "countdown";
  name: string;
  /** Local "YYYY-MM-DD" the countdown ends (launch day). */
  endsOn: string;
}

export interface AutomationPayload {
  kind: "automation";
  name: string;
  trigger: "purchase" | "opt-in";
  steps: { afterDays: number; action: "send-email" | "add-tag"; detail: string }[];
}

export type ByldityPayload = EmailSequencePayload | PagePayload | CountdownPayload | AutomationPayload;

export interface Handoff {
  app: ByldityAppId;
  label: string;
  payload: ByldityPayload;
}

export interface PushResult {
  ok: boolean;
  message: string;
  externalId?: string;
}

/** The contract a real BYLDITY connector implements (server-side, with the owner's credentials). */
export interface ByldityConnector {
  app: ByldityAppId;
  connected: boolean;
  push(payload: ByldityPayload): Promise<PushResult>;
}

class NotConnected implements ByldityConnector {
  connected = false;
  constructor(public app: ByldityAppId) {}
  async push(): Promise<PushResult> {
    return { ok: false, message: `${BYLDITY_APPS.find((a) => a.id === this.app)?.name ?? this.app} isn't connected yet. Download the payload and import it manually for now.` };
  }
}

const connectors = new Map<ByldityAppId, ByldityConnector>();

/** Register a real connector when the integration is built. */
export function registerConnector(c: ByldityConnector) {
  connectors.set(c.app, c);
}

export function getConnector(app: ByldityAppId): ByldityConnector {
  return connectors.get(app) ?? new NotConnected(app);
}

/** What a campaign would send to each BYLDITY app. */
export function campaignHandoffs(c: CampaignDrop): Handoff[] {
  const name = c.featured.title || c.theme || c.title;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "campaign";
  const followUps = c.emails.filter((e) => e.day > 0);
  return [
    {
      app: "byldsend",
      label: `${c.emails.length} launch emails`,
      payload: {
        kind: "email-sequence",
        name: `${name} — launch`,
        launchDate: campaignLaunchDate(c),
        emails: [...c.emails].sort((a, b) => a.day - b.day).map((e) => ({ sendOn: entryDate(c, e.day), dayOffset: e.day, subject: e.subject, preview: e.preview, body: e.body, ctaText: e.ctaText, ctaUrl: e.ctaUrl })),
      },
    },
    { app: "byldpages", label: "Sales page", payload: { kind: "page", name: `${name} — sales page`, slug, html: salesPageHtml(campaignSalesPageData(c), { title: name }) } },
    { app: "byld-countdown", label: "Launch countdown", payload: { kind: "countdown", name: `${name} launch`, endsOn: campaignLaunchDate(c) } },
    {
      app: "byldflow",
      label: "Buyer follow-up automation",
      payload: { kind: "automation", name: `${name} — buyers`, trigger: "purchase", steps: [{ afterDays: 0, action: "add-tag", detail: `bought:${slug}` }, ...followUps.map((e) => ({ afterDays: e.day, action: "send-email" as const, detail: e.subject }))] },
    },
  ];
}
