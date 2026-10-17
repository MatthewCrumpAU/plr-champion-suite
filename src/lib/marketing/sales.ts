import type { SalesPageData, SalesSection, SalesSectionType } from "@/lib/models/marketing";
import { SALES_SECTION_LABELS } from "@/lib/models/marketing";
import { fontById } from "@/lib/fonts";
import { escapeHtml, uid } from "@/lib/utils";
import type { PMDoc } from "@/lib/doc/types";
import { B } from "@/lib/doc/build";

/**
 * Sales page templates and rendering. Templates use the user's own product details and [placeholders] — they never
 * include testimonials, results, income claims, invented scarcity or "valued at" figures.
 */

export interface SalesContext {
  productName: string;
  audience: string;
  outcome: string;
  format: string;
  included: string[];
  bonuses: string[];
  price: string;
}

const item = (title: string, text = "") => ({ id: uid("si"), title, text });

/** "Remote professionals and freelancers who work from home" → "remote professionals and freelancers". */
export function shortAudience(a: string): string {
  const t = a.trim().replace(/\s+(who|that|which)\s.*$/i, "").replace(/[.!]$/, "");
  return /^[A-Z][a-z]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t;
}

/** "A simple plan for remote workers to do focused work…" → "do focused work…". */
export function outcomeFrom(subtitle: string): string {
  const m = /\bto\s+(.+)$/i.exec(subtitle.trim());
  return m ? m[1].replace(/[.!]$/, "").trim() : "";
}

export function salesTemplate(type: SalesSectionType, c: SalesContext): Partial<SalesSection> {
  const name = c.productName || "[Product name]";
  const who = shortAudience(c.audience) || "[your audience]";
  const outcome = c.outcome || "[the result your reader wants]";
  const fmt = c.format || "guide";
  switch (type) {
    case "headline":
      return { heading: `${outcome[0]?.toUpperCase() ?? ""}${outcome.slice(1)} — without the overwhelm`, subheading: "", body: "", bullets: [], items: [item(`The simple ${fmt} that helps ${who} ${outcome}`), item(`Finally: a practical way to ${outcome}`), item(`${name}: your step-by-step plan to ${outcome}`)] };
    case "subheadline":
      return { heading: `${name} gives ${who} a clear, practical plan you can start using today.`, items: [] };
    case "problem":
      return {
        heading: "Does this sound familiar?",
        body: `You know you should [describe what the reader is trying to do], but [describe the obstacle in their words].\n\nIt's not that you're not trying. Most advice is either too vague or too complicated to use on a busy day.\n\n${name} takes a different approach: [describe your approach in one sentence].`,
        bullets: ["[Pain point 1 — in the reader's words]", "[Pain point 2]", "[Pain point 3]"],
      };
    case "introduction":
      return { heading: `Introducing ${name}`, subheading: `A ${fmt} for ${who}`, body: `${name} is a [length/format] ${fmt} that walks you through [what it covers]. It's written for ${who} who want to ${outcome} — without [the thing they want to avoid].` };
    case "benefits":
      return { heading: "What you'll be able to do", bullets: ["[Benefit 1 — an outcome the reader cares about]", "[Benefit 2]", "[Benefit 3]", "[Benefit 4]", "[Benefit 5]"] };
    case "features":
      return { heading: "Inside the product", items: [item("[Feature]", "[What it helps the reader do]"), item("[Feature]", "[What it helps the reader do]"), item("[Feature]", "[What it helps the reader do]"), item("[Feature]", "[What it helps the reader do]")] };
    case "included":
      return { heading: "What's included", items: (c.included.length ? c.included : ["[Component 1]", "[Component 2]"]).map((t) => item(t, "[One-sentence description]")) };
    case "bonuses":
      return { heading: "Also included", items: (c.bonuses.length ? c.bonuses : ["[Bonus name]"]).map((t) => item(t, "[What it is and how it helps]")) };
    case "pricing":
      return { heading: `Get ${name} today`, body: `Everything you need to ${outcome}, in one ${fmt}.`, bullets: [`${name} (${fmt})`, ...c.bonuses.map((b) => b), "Instant digital download"], buttonText: "Get instant access" };
    case "faq":
      return {
        heading: "Frequently asked questions",
        items: [
          item("Who is this for?", `${name} is for ${who}.`),
          item("What format is it in?", `It's a digital ${fmt} you can read on any device. [Add file formats.]`),
          item("How do I get access?", "You'll receive a download link by email straight after purchase. [Confirm your delivery process.]"),
          item("What if it's not right for me?", "[Describe your refund policy here.]"),
          item("How do I contact you?", "[Your support email or help desk link.]"),
        ],
      };
    case "cta":
      return { heading: `Ready to ${outcome}?`, body: `Start with ${name} today.`, buttonText: "Get instant access" };
    case "guarantee":
      return { heading: "Our guarantee", body: "[State your refund policy in plain language — for example, how many days buyers have to request a refund and how to ask for one. Only promise what you will honour.]" };
  }
}

export function newSectionFromTemplate(type: SalesSectionType, c: SalesContext): SalesSection {
  return { id: uid("sec"), type, enabled: true, heading: "", subheading: "", body: "", bullets: [], items: [], buttonText: "", ...salesTemplate(type, c) };
}

export function sectionIsEmpty(s: SalesSection): boolean {
  return !s.heading.trim() && !s.subheading.trim() && !s.body.trim() && !s.bullets.some((b) => b.trim()) && !s.items.some((i) => i.title.trim() || i.text.trim());
}

/* ------------------------------------------------------------------ */
/* HTML rendering (preview + export)                                    */
/* ------------------------------------------------------------------ */
const safeUrl = (u: string) => (/^https?:\/\//i.test(u.trim()) ? u.trim() : "");
const paras = (t: string) =>
  t
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

function priceText(d: SalesPageData): string {
  if (d.price.amount === null || !Number.isFinite(d.price.amount)) return "";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: d.price.currency || "USD", maximumFractionDigits: d.price.amount % 1 ? 2 : 0 }).format(d.price.amount);
  } catch {
    return `${d.price.currency} ${d.price.amount}`;
  }
}

function button(d: SalesPageData, text: string) {
  const url = safeUrl(d.checkoutUrl);
  const label = escapeHtml(text || "Get instant access");
  return url ? `<a class="btn" href="${escapeHtml(url)}">${label}</a>` : `<span class="btn" title="Add a checkout link in Page settings">${label}</span>`;
}

function renderSection(s: SalesSection, d: SalesPageData, heroImage: string | null): string {
  const h = s.heading.trim();
  const sub = s.subheading.trim();
  const bullets = s.bullets.filter((b) => b.trim());
  const items = s.items.filter((i) => i.title.trim() || i.text.trim());
  const cls = `sec sec-${s.type}`;
  switch (s.type) {
    case "headline": {
      const head = h || items[0]?.title || "";
      return `<header class="${cls} hero">${heroImage ? `<img class="hero-img" src="${heroImage}" alt="">` : ""}<div>${head ? `<h1>${escapeHtml(head)}</h1>` : ""}${sub ? `<p class="lead">${escapeHtml(sub)}</p>` : ""}${paras(s.body)}</div></header>`;
    }
    case "subheadline":
      return `<section class="${cls}"><p class="lead">${escapeHtml(h || items[0]?.title || "")}</p>${paras(s.body)}</section>`;
    case "pricing": {
      const price = priceText(d);
      return `<section class="${cls}"><div class="card price-card">${h ? `<h2>${escapeHtml(h)}</h2>` : ""}${sub ? `<p class="sub">${escapeHtml(sub)}</p>` : ""}${paras(s.body)}${bullets.length ? `<ul class="ticks">${bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>` : ""}${price ? `<p class="price">${escapeHtml(price)}<span>${escapeHtml(d.price.label)}</span></p>` : ""}${button(d, s.buttonText)}</div></section>`;
    }
    case "cta":
      return `<section class="${cls} cta">${h ? `<h2>${escapeHtml(h)}</h2>` : ""}${paras(s.body)}${button(d, s.buttonText)}</section>`;
    case "faq":
      return `<section class="${cls}">${h ? `<h2>${escapeHtml(h)}</h2>` : ""}${items.map((i) => `<details><summary>${escapeHtml(i.title)}</summary>${paras(i.text)}</details>`).join("")}</section>`;
    case "guarantee":
      return `<section class="${cls}"><div class="card guarantee">${h ? `<h2>${escapeHtml(h)}</h2>` : ""}${paras(s.body)}</div></section>`;
    default:
      return `<section class="${cls}">${h ? `<h2>${escapeHtml(h)}</h2>` : ""}${sub ? `<p class="sub">${escapeHtml(sub)}</p>` : ""}${paras(s.body)}${bullets.length ? `<ul class="${s.type === "benefits" ? "ticks" : "dots"}">${bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>` : ""}${items.length ? `<div class="grid">${items.map((i) => `<div class="card"><h3>${escapeHtml(i.title)}</h3>${paras(i.text)}</div>`).join("")}</div>` : ""}${s.buttonText ? button(d, s.buttonText) : ""}</section>`;
  }
}

export function salesPageHtml(d: SalesPageData, opts: { heroImage?: string | null; title?: string; headExtra?: string } = {}): string {
  const t = d.theme;
  const hf = fontById(t.headingFont);
  const bf = fontById(t.bodyFont);
  const r = t.rounded ? "14px" : "4px";
  const css = `
*{box-sizing:border-box}html,body{margin:0}body{background:${t.background};color:${t.text};font-family:${bf.css};font-size:17px;line-height:1.65;-webkit-font-smoothing:antialiased}
.wrap{max-width:${Math.max(560, Math.min(1200, t.maxWidth))}px;margin:0 auto;padding:40px 24px 80px}
h1,h2,h3{font-family:${hf.css};line-height:1.2;margin:0 0 .5em}h1{font-size:clamp(30px,5vw,46px);letter-spacing:-.01em}h2{font-size:clamp(24px,3.4vw,32px)}h3{font-size:19px}
p{margin:0 0 1em}.lead{font-size:1.2em;opacity:.85}.sub{opacity:.75;margin-top:-.25em}
.sec{padding:36px 0;border-bottom:1px solid rgba(0,0,0,.06)}.sec:last-child{border-bottom:0}
.hero{display:grid;gap:28px;align-items:center;text-align:center;padding-top:16px}.hero-img{max-width:min(320px,70%);margin:0 auto;display:block;border-radius:6px;box-shadow:0 18px 40px rgba(0,0,0,.18)}
@media(min-width:760px){.hero:has(.hero-img){grid-template-columns:300px 1fr;text-align:left}.hero-img{max-width:100%}}
.grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.card{background:${t.surface};border-radius:${r};padding:20px 22px}.card p:last-child{margin:0}
ul{padding-left:0;list-style:none;margin:0 0 1em}li{position:relative;padding-left:30px;margin:.45em 0}
.ticks li::before{content:"✓";position:absolute;left:0;top:0;color:${t.primary};font-weight:700}.dots li::before{content:"";position:absolute;left:8px;top:.7em;width:7px;height:7px;border-radius:50%;background:${t.accent}}
.btn{display:inline-block;background:${t.primary};color:#fff;text-decoration:none;font-weight:700;padding:15px 30px;border-radius:${r};margin-top:8px;font-family:${bf.css}}
.price-card{text-align:center;border:2px solid ${t.primary}}.price{font-size:42px;font-weight:800;font-family:${hf.css};margin:12px 0 4px}.price span{display:block;font-size:14px;font-weight:500;opacity:.7}
.price-card ul{display:inline-block;text-align:left}.cta{text-align:center}.guarantee{border-left:4px solid ${t.accent}}
details{background:${t.surface};border-radius:${r};padding:14px 18px;margin:10px 0}summary{cursor:pointer;font-weight:600}details p{margin:.6em 0 0}
footer{opacity:.55;font-size:13px;text-align:center;padding-top:30px}`;
  const body = d.sections
    .filter((s) => s.enabled)
    .map((s) => renderSection(s, d, s.type === "headline" ? (opts.heroImage ?? null) : null))
    .join("\n");
  const title = escapeHtml(opts.title || d.productName || "Sales page");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>${opts.headExtra ?? ""}<style>${css}</style></head><body><main class="wrap">${body}<footer>© ${new Date().getFullYear()} ${escapeHtml(d.productName || "")}</footer></main></body></html>`;
}

/** Sales copy as a document (for DOCX / PDF / Markdown export). */
export function salesPageDoc(d: SalesPageData): PMDoc {
  const out = [] as ReturnType<typeof B.p>[];
  for (const s of d.sections.filter((x) => x.enabled)) {
    out.push(B.h(2, s.type === "headline" || s.type === "subheadline" ? SALES_SECTION_LABELS[s.type] : s.heading || SALES_SECTION_LABELS[s.type]));
    if ((s.type === "headline" || s.type === "subheadline") && s.heading) out.push(B.p(`**${s.heading}**`));
    if (s.subheading) out.push(B.p(`*${s.subheading}*`));
    for (const p of s.body.split(/\n{2,}/).filter((x) => x.trim())) out.push(B.p(p.trim()));
    const bullets = s.bullets.filter((b) => b.trim());
    if (bullets.length) out.push(B.ul(bullets));
    for (const i of s.items.filter((x) => x.title.trim() || x.text.trim())) out.push(B.p(i.text ? `**${i.title}** — ${i.text}` : `**${i.title}**`));
    if (s.buttonText) out.push(B.p(`[Button: ${s.buttonText}]`));
  }
  return B.doc(...out);
}
