import { describe, expect, it } from "vitest";
import { defaultSalesPageData } from "@/lib/models/defaults";
import { salesPageHtml, salesTemplate, newSectionFromTemplate } from "@/lib/marketing/sales";
import { emailTemplates, templateEmails, sortEmails, campaignCsv } from "@/lib/marketing/emails";
import { templateNames } from "@/lib/marketing/names";
import { autoSchedule, monthGrid, templatePosts, hashtagsFor } from "@/lib/marketing/social";
import { B } from "@/lib/doc/build";
import { SALES_SECTION_ORDER } from "@/lib/models/defaults";
import { EMAIL_SEQUENCES, NAME_CATEGORIES } from "@/lib/ai/tasks";

const ctx = { productName: "Calm Focus", audience: "remote workers", outcome: "finish work by five", format: "ebook", included: ["Calm Focus ebook"], bonuses: ["Focus checklist"], price: "27" };
const FORBIDDEN = /testimonial|guarantee(d)? (results|income)|\$\d+,?\d* (a|per) (month|day)|make \$|limited spots|only \d+ left/i;

describe("sales page", () => {
  it("templates every section without testimonials or income claims", () => {
    for (const t of SALES_SECTION_ORDER) {
      const s = salesTemplate(t, ctx);
      expect(JSON.stringify(s)).not.toMatch(FORBIDDEN);
    }
  });

  it("escapes user content and only links http(s) checkout URLs", () => {
    const d = defaultSalesPageData({ productName: "<script>alert(1)</script>", checkoutUrl: "javascript:alert(1)", sections: [newSectionFromTemplate("headline", ctx), { ...newSectionFromTemplate("cta", ctx), heading: '<img src=x onerror="alert(1)">' }] });
    const html = salesPageHtml(d);
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("&lt;img");
    const ok = salesPageHtml({ ...d, checkoutUrl: "https://pay.example.com/x" });
    expect(ok).toContain('href="https://pay.example.com/x"');
  });

  it("omits disabled sections and shows the price", () => {
    const d = defaultSalesPageData({ productName: "Calm", price: { amount: 27, currency: "USD", label: "One-time", billing: "one-time" } });
    d.sections = d.sections.map((s) => ({ ...s, ...salesTemplate(s.type, ctx), enabled: s.type !== "faq" }));
    const html = salesPageHtml(d);
    expect(html).toContain("$27");
    expect(html).not.toContain("Frequently asked questions");
  });
});

describe("email templates", () => {
  it("has a template for every sequence type, in order, without fake urgency", () => {
    for (const t of EMAIL_SEQUENCES) {
      const list = emailTemplates(t, { productName: "Calm Focus", audience: "remote workers", outcome: "finish by five", fromName: "Sam", topics: ["Focus blocks"], price: "27" });
      expect(list.length).toBeGreaterThan(0);
      for (const e of list) {
        expect(e.subject.length).toBeGreaterThan(3);
        expect(e.body).toContain("Hi [First name]");
        expect(e.body).not.toMatch(FORBIDDEN);
      }
    }
  });
  it("exports CSV in send order", () => {
    const emails = templateEmails("launch", { productName: "X", audience: "", outcome: "", fromName: "", topics: [], price: "" }, "https://x.test");
    expect(sortEmails(emails)[0].day).toBe(-3);
    const csv = campaignCsv({ sequenceType: "launch", goal: "", fromName: "", defaultCtaUrl: "", emails: [...emails].reverse() });
    expect(csv.split("\n")[1]).toMatch(/^1,-3,/);
  });
});

describe("names", () => {
  it("fills patterns for every category and skips duplicates", () => {
    for (const c of NAME_CATEGORIES) {
      const list = templateNames(c, { topic: "remote work", audience: "freelancers", outcome: "finish work by five", format: "ebook" });
      expect(list.length).toBeGreaterThan(4);
      expect(list.every((n) => !/\{|\}/.test(n.name))).toBe(true);
    }
    const first = templateNames("product-title", { topic: "focus", audience: "", outcome: "", format: "" });
    const again = templateNames("product-title", { topic: "focus", audience: "", outcome: "", format: "" }, first.map((n) => n.name));
    expect(again).toHaveLength(0);
  });
});

describe("social", () => {
  const sources = [{ title: "Chapter 1: Focus Blocks", content: B.doc(B.p("Deep work needs protected time. Block two hours every morning."), B.ul(["Turn off notifications", "Close email", "Use a timer"])) }];
  it("creates posts per platform with real points from the chapter", () => {
    const posts = templatePosts({ sources, platforms: ["instagram", "linkedin", "video-script"], kind: "educational", count: 3, context: { productName: "Calm", audience: "remote workers", niche: "productivity", link: "" } });
    expect(posts.map((p) => p.platform)).toEqual(["instagram", "linkedin", "video-script"]);
    expect(posts[0].text).toContain("Turn off notifications");
    expect(posts[2].text).toContain("[HOOK]");
    expect(posts[0].hashtags.length).toBeGreaterThan(0);
  });
  it("builds a Monday-first month grid and auto-schedules", () => {
    const g = monthGrid("2026-10");
    expect(g).toHaveLength(42);
    expect(g[0].day).toBe("2026-09-28");
    const posts = templatePosts({ sources, platforms: ["facebook"], kind: "mixed", count: 3, context: { productName: "Calm", audience: "", niche: "", link: "" } });
    const s = autoSchedule(posts, "2026-10-20", 2);
    expect(s.map((p) => p.scheduledFor)).toEqual(["2026-10-20", "2026-10-22", "2026-10-24"]);
    expect(hashtagsFor("Remote productivity", "Chapter 2: Evening Planning")).toContain("Productivity");
  });
});
