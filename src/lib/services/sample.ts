import { getRepos, type Repositories } from "@/lib/data";
import type { BrandKit } from "@/lib/data/types";
import { B } from "@/lib/doc/build";
import { newChapter, type Chapter } from "@/lib/models/document";
import { defaultRightsReviewData } from "@/lib/models/defaults";
import { nowIso, uid } from "@/lib/utils";
import { docWords } from "@/lib/doc/text";
import { createAsset } from "./assets";
import { createProject, purgeProject, updateProject } from "./projects";
import { sampleExtras } from "./sample-extras";

/**
 * Sample project created on first run so every tool can be explored without uploading a file.
 * The content is original demonstration text written for PLR Champion (not third-party PLR).
 */

function originalChapters(): Chapter[] {
  const c = (title: string, ...content: Parameters<typeof B.doc>) => newChapter(title, B.doc(...content));
  return [
    c(
      "Introduction",
      B.p("In today's fast-paced world, more people than ever are working from home. It goes without saying that the freedom is wonderful, but working from home also brings a unique set of challenges that can quietly drain your focus and your energy."),
      B.p("This guide will show you simple, proven ways to get more done in less time without burning out. You will learn how to set up your space, plan your day, protect your attention and finish each day feeling in control."),
      B.p("Each chapter ends with a few action steps. Take your time, try one idea at a time, and keep what works for you."),
    ),
    c(
      "Chapter 1: Designing a Workspace That Works",
      B.p("Your environment shapes your behaviour. If your desk is also your dining table, your brain never gets a clear signal that it is time to work. A dedicated space, even a small one, makes it much easier to switch into focus mode."),
      B.h(2, "Start with the essentials"),
      B.ul(["A comfortable chair and a desk at the right height", "Good natural light, or a daylight-style lamp", "A clear surface with only what you need for today", "Headphones to block out household noise"]),
      B.p("First and foremost, keep the space tidy. Clutter competes for your attention. Spend five minutes at the end of each day resetting your desk so tomorrow starts with a clean slate."),
      B.h(2, "Action steps"),
      B.ol(["Choose one spot that is only for work.", "Remove three items from your desk that you do not use daily.", "Set up your lighting before your next work session."]),
    ),
    c(
      "Chapter 2: Planning Your Day the Night Before",
      B.p("The most productive people rarely start their day wondering what to do. They decide the night before. Planning ahead removes the morning decision fatigue that leads to checking email and social media instead of doing important work."),
      B.p("Each evening, write down the three most important tasks for tomorrow. These are your priorities. Everything else is a bonus. When you sit down to work, start with the first task and keep going until it is done."),
      B.h(2, "The 3-1-1 method"),
      B.p("Plan three important tasks, one quick win you can finish in under fifteen minutes, and one thing you will do for yourself, such as a walk or a proper lunch break."),
      B.h(2, "Action steps"),
      B.ol(["Keep a notebook or planner beside your desk.", "Tonight, write tomorrow's three priorities.", "Review your list for two minutes each morning."]),
    ),
    c(
      "Chapter 3: Protecting Your Focus",
      B.p("At the end of the day, your attention is your most valuable resource. Every notification, every open tab and every quick check of your phone breaks your concentration, and it can take a long time to get it back."),
      B.p("Try working in focused blocks of 45 to 90 minutes. During a focus block, close your email, silence your phone and keep only the tools you need open."),
      B.h(2, "Simple ways to reduce distractions"),
      B.ul(["Turn off non-essential notifications on your phone and computer", "Tell the people you live with when you are in a focus block", "Batch email and messages into two or three set times per day", "Keep a 'later' list for ideas that pop up mid-task"]),
      B.h(2, "Action steps"),
      B.ol(["Schedule two focus blocks in your calendar tomorrow.", "Switch off three types of notification today."]),
    ),
    c(
      "Chapter 4: Ending the Day and Avoiding Burnout",
      B.p("When your office is at home, work can easily spill into your evenings. Without a clear finish line, you never fully rest, and over time your productivity drops. A shutdown routine tells your brain the working day is over."),
      B.p("Your shutdown routine might include reviewing what you finished, writing tomorrow's priorities, tidying your desk and closing your laptop. Then do something that marks the transition, like a short walk."),
      B.p("Remember that rest is not a reward for finishing everything. Rest is part of doing good work. Protect your evenings and weekends and you will return to your desk with more energy and better ideas."),
      B.h(2, "Action steps"),
      B.ol(["Write a five-step shutdown routine.", "Pick a set finish time and stick to it this week.", "Plan one screen-free activity for this evening."]),
    ),
  ];
}

function editedChapters(originals: Chapter[]): Chapter[] {
  const chapters = originals.map((o) => ({ ...newChapter(o.title, JSON.parse(JSON.stringify(o.content))), sourceChapterId: o.id }));
  chapters[0] = {
    ...chapters[0],
    title: "Welcome: Calm, Focused, Done by Five",
    content: B.doc(
      B.p("Working from home should give you more freedom, not more stress. Yet for many remote professionals the day blurs together: the laptop stays open, the to-do list keeps growing and focus feels harder to find."),
      B.p("The Calm Productivity Blueprint is a short, practical plan for remote workers who want to do their best work in fewer hours. You'll set up a space that supports focus, plan days that start with momentum and finish each evening knowing your work is handled."),
      B.callout("tip", B.p("Try one idea at a time. Small changes, practised daily, beat big plans that never stick.")),
    ),
  };
  chapters[1] = { ...chapters[1], title: "Design a Workspace That Works for You" };
  return chapters;
}

export const SAMPLE_FLAG = "sampleSeeded";

export async function seedSampleProject(repos: Repositories = getRepos()) {
  const now = nowIso();
  const kit: BrandKit = {
    id: uid("kit"),
    name: "SAMPLE — Calm Focus Co.",
    brandName: "Calm Focus Co.",
    tagline: "Focused work. Calm evenings.",
    logoFileId: null,
    colors: { primary: "#2F6F62", secondary: "#14302B", accent: "#E9B949", dark: "#0F1F1C", light: "#F4F7F5" },
    palette: [],
    headingFont: "playfair",
    bodyFont: "inter",
    authorName: "Sample Author",
    website: "calmfocus.example",
    email: "",
    voice: "Calm, practical, encouraging. Short sentences. No hype.",
    positioning: "Calm over hustle: simple routines for remote professionals.",
    audience: "Remote professionals and freelancers",
    notes: "Sample brand kit used by the sample project.",
    isSample: true,
    createdAt: now,
    updatedAt: now,
  };
  await repos.brandKits.put(kit);

  const project = await createProject(
    {
      name: "SAMPLE — Calm Productivity Blueprint",
      description: "Sample project. A short ebook for remote professionals who feel scattered working from home. Covers workspace setup, evening planning, focus blocks and a shutdown routine.",
      niche: "Remote work productivity",
      audience: "Remote professionals and freelancers who work from home",
      productType: "ebook",
      stage: "rebranding",
      brandKitId: kit.id,
      plannedPrice: 17,
      notes: "This is a SAMPLE project created on first run so you can explore every tool without uploading a file. Delete it any time.",
      isSample: true,
    },
    repos,
  );

  const originals = originalChapters();
  const doc = await createAsset(
    project.id,
    "document",
    {
      title: "The Calm Productivity Blueprint",
      status: "in-progress",
      data: {
        role: "main",
        format: "ebook",
        subtitle: "A simple plan for remote workers to do focused work and finish by five",
        author: "Sample Author",
        description: "A short ebook for remote professionals who feel scattered working from home.",
        chapterLabel: "Chapter",
        chapters: editedChapters(originals),
        original: {
          sources: [
            {
              id: uid("src"),
              fileName: "work-from-home-productivity-secrets.docx (sample)",
              format: "sample",
              fileId: null,
              fingerprint: "sample-calm-productivity",
              importedAt: now,
              warnings: [],
              wordCount: originals.reduce((n, c) => n + docWords(c.content), 0),
              pageCount: null,
            },
          ],
          chapters: originals,
        },
        rules: [
          { id: uid("rule"), find: "Work From Home Productivity Secrets", replace: "The Calm Productivity Blueprint", caseSensitive: false, wholeWord: false, enabled: true },
          { id: uid("rule"), find: "In today's fast-paced world, ", replace: "", caseSensitive: false, wholeWord: false, enabled: true },
        ],
      },
    },
    repos,
  );

  await createAsset(
    project.id,
    "rights-review",
    {
      title: "Licence review — sample content",
      data: defaultRightsReviewData({
        licenceName: "Sample content licence",
        licenceType: "custom",
        source: { vendor: "PLR Champion (sample)", productName: "Work From Home Productivity Secrets (sample)", purchaseDate: "", orderRef: "", url: "", notes: "" },
        licenceText:
          "SAMPLE LICENCE — demonstration only.\nThis sample content was written for PLR Champion so you can try the tools. It is not a real PLR licence.\n\nWhen you import real PLR, paste the vendor's licence terms here and review each right below before you sell.",
        summary: "Sample content — replace with the real licence terms when you import a real PLR product.",
      }),
    },
    repos,
  );

  await sampleExtras(project.id, doc.id, kit, repos).catch(() => undefined);
  await updateProject(project.id, { mainDocumentId: doc.id }, repos);
  return project;
}

/**
 * Seeds the sample project once, into an empty workspace only (never after a restore or real use).
 * The "seeded" flag is written only after the sample is complete, so a first visit that is interrupted
 * (a reload or navigation mid-way) is cleaned up and finished on the next load instead of leaving half a sample.
 * A Web Lock stops two tabs opened at the same moment from both seeding.
 */
export async function ensureSampleProject(repos: Repositories = getRepos()) {
  const run = async () => {
    if (await repos.meta.get(SAMPLE_FLAG)) return null;
    const existing = await repos.projects.list({ includeArchived: true, includeDeleted: true });
    if (existing.some((p) => !p.isSample)) {
      await repos.meta.set(SAMPLE_FLAG, true);
      return null;
    }
    if (existing.length) {
      // Only an unfinished sample is present: remove it and start again.
      for (const p of existing) await purgeProject(p.id, repos);
      for (const k of await repos.brandKits.list()) if (k.name.startsWith("SAMPLE —")) await repos.brandKits.delete(k.id);
    }
    const sample = await seedSampleProject(repos);
    await repos.meta.set(SAMPLE_FLAG, true);
    return sample;
  };
  if (typeof navigator !== "undefined" && "locks" in navigator && navigator.locks) return navigator.locks.request("plrc-sample-seed", run);
  return run();
}
