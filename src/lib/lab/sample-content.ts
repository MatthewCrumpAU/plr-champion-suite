import type { SampleLibrary } from "@/lib/membership/sample-content";
import type { CoverMotif } from "@/lib/membership/covers";
import type { AccessTier } from "@/lib/membership/types";
import type { BusinessModel, Experience, SessionKind } from "./types";

/**
 * PLR Profit Lab sample content for private testing. All text is original demonstration content.
 * Campaign drops feature copies of PLR Champion sample products (by key) so their files are real
 * DOCX/PDF documents. Everything seeded from here is flagged as a sample and can be removed from
 * Profit Lab Admin → Data & backup.
 */

/* ---------------------------------------- Training ---------------------------------------- */

export const LAB_SAMPLE: SampleLibrary = {
  categories: [],
  drops: [],
  products: [],
  courses: [
    {
      key: "lab-start",
      kind: "course",
      title: "Getting Started with PLR Profit Lab",
      summary: "How the 90-Day Profit Path, Monthly Profit Campaign Drops and Build Days fit together — and how to use them every week.",
      level: "beginner",
      toolHint: null,
      access: "member",
      palette: ["#15803d", "#0a140f", "#f2b632"],
      motif: "steps",
      modules: [
        {
          title: "Your 90-Day Profit Path",
          lessons: [
            {
              title: "How your plan is built",
              type: "article",
              durationMin: 6,
              body: "Your Profit Path is built from your answers: how much experience you have, the hours you can give each week, the products you already own, your business model and your launch goals.\n\nThe plan has thirteen weeks. The first weeks are about **foundations** and **creating** your product, then you **prepare** the sales page, emails and posts, and then you **launch**. After each launch there's a review week, and between launches you **grow** steadily.\n\nEach week is sized to your hours. Core tasks are always in the plan. Recommended and stretch tasks are added only when they fit — the rest appear as *optional extras* you can pick up if you have time.\n\nIf your week changes, update your answers. The plan re-plans instantly and keeps every task you've already ticked.",
            },
            {
              title: "Your first week",
              type: "checklist",
              durationMin: 10,
              body: "Tick these off as you go:\n\n- Answer the Profit Path questions\n- Block your weekly hours in your calendar\n- Open the Today view and finish your first task\n- Add the plan to your calendar with the .ics download\n- Write your 90-day goal somewhere you'll see it",
            },
          ],
        },
        {
          title: "Campaign Drops and Build Days",
          lessons: [
            {
              title: "Using a Monthly Profit Campaign Drop",
              type: "article",
              durationMin: 7,
              body: "Each month's Campaign Drop is a complete launch kit for one PLR product: the product files, rebranding instructions, positioning, sales-page copy, an email sequence, social posts, a lead magnet, bonuses, a launch checklist and a promotional calendar.\n\n**Make it yours.** The copy is a starting point. Rewrite it in your own voice and replace every [placeholder] with your details. Never publish testimonials, results or deadlines that aren't real.\n\n**Start in the studio.** The *Start this campaign in the studio* button creates a project with the sales page, emails, dated posts and a launch plan already in place — and the product ready to edit.",
            },
            {
              title: "Getting the most from Build Days",
              type: "article",
              durationMin: 5,
              body: "Build Days are monthly working sessions. You'll get a short teaching block, two build sprints, hot seats for feedback and a share-and-commit session.\n\nBefore the day, download the materials and choose what you'll work on. During the day, tick off sessions and checklist items. Afterwards, work through your action items — the Build Day page tracks them, and you can add your own.",
            },
          ],
        },
      ],
    },
    {
      key: "lab-tut-path",
      kind: "tutorial",
      title: "Profit Path quick-start",
      summary: "A five-minute tour of the Today view, weekly milestones and launch checklists.",
      level: "beginner",
      toolHint: null,
      access: "member",
      palette: ["#166534", "#052e16", "#fde68a"],
      motif: "rays",
      modules: [
        {
          title: "Quick-start",
          lessons: [
            {
              title: "Today, This week and the 13-week view",
              type: "article",
              durationMin: 5,
              body: "**Today** shows the tasks planned for today plus anything overdue. Tick a task when it's done; open it to see why it matters and which tool to use.\n\n**This week** shows the week's milestone and every task day by day. Use the weekly reflection box to note what worked.\n\n**All 13 weeks** shows the whole journey, including each launch.\n\n**Launch checklists** hold the seven-days-before, launch-day and after-launch checks for every launch in your plan.",
            },
          ],
        },
      ],
    },
  ],
  resources: [
    {
      title: "90-day planning worksheet",
      description: "Goal, numbers and weekly hours on one page — fill it in before you answer the Profit Path questions.",
      type: "template",
      access: "member",
      file: {
        name: "90-day-planning-worksheet.md",
        content:
          "# 90-day planning worksheet\n\n## My goal for the next 90 days\n\n_______________________________________\n\n## Why it matters to me\n\n_______________________________________\n\n## My numbers\n\n- Revenue goal: ____________\n- Price of my first product: ____________\n- Subscribers I want to reach: ____________\n\n## My time\n\n- Hours I can give each week: ____\n- Days I'll work on it: Mon  Tue  Wed  Thu  Fri  Sat  Sun\n\n## What I already have\n\n- PLR products: ____\n- Email list (size): ____\n- Website / checkout: ____\n",
      },
    },
    {
      title: "Weekly review template",
      description: "Ten minutes every Friday: what got done, what got stuck, what's next.",
      type: "template",
      access: "member",
      file: { name: "weekly-review.md", content: "# Weekly review\n\n## Done this week\n\n- \n\n## Stuck on\n\n- \n\n## Numbers (visitors, subscribers, sales)\n\n- \n\n## Next week's three priorities\n\n1. \n2. \n3. \n" },
    },
    {
      title: "Launch-day run sheet",
      description: "An hour-by-hour plan for launch day.",
      type: "checklist",
      access: "member",
      file: {
        name: "launch-day-run-sheet.md",
        content: "# Launch-day run sheet\n\n- [ ] 8:00 — Final test purchase and delivery check\n- [ ] 9:00 — Publish the sales page and open checkout\n- [ ] 9:15 — Send the launch email\n- [ ] 9:30 — Post and pin the announcement\n- [ ] 12:00 — Reply to every comment and question\n- [ ] 15:00 — Check orders were delivered\n- [ ] 18:00 — Record visitors and sales\n",
      },
    },
    {
      title: "Subject line swipe file",
      description: "Thirty honest subject-line patterns for launch emails — no fake urgency.",
      type: "swipe",
      access: "premium",
      file: {
        name: "subject-line-swipe.txt",
        content:
          "Honest subject-line patterns\n\n1. The [one thing] I'd do first about [topic]\n2. [Product] is ready\n3. Is [product] right for you?\n4. What's inside [product]\n5. A useful excerpt from [product]\n6. Your questions about [product], answered\n7. Why I made [product]\n8. The mistake most [audience] make with [topic]\n9. [Number] minutes to [small result]\n10. A simple way to [outcome]\n",
      },
    },
    { title: "Profit Calculator", description: "Price, fees, refunds and break-even — work out your numbers before you launch.", type: "tool", access: "member", url: "/profit" },
  ],
};

/* ---------------------------------------- Campaigns ---------------------------------------- */

export interface SampleBonusDef {
  title: string;
  description: string;
  kind: "workbook" | "checklist";
}

export interface SampleCampaignDef {
  /** Months relative to now (0 = this month). Future campaigns are scheduled. */
  monthOffset: number;
  /** PLR Champion sample product featured this month. */
  productKey: string;
  theme: string;
  summary: string;
  audience: string;
  /** "to …" outcome used by the copy templates. */
  outcome: string;
  problem: string;
  promise: string;
  angle: string;
  price: number;
  launchDay: number;
  access: AccessTier;
  leadMagnet: { title: string; format: string; description: string; outline: string[] };
  bonuses: SampleBonusDef[];
  palette: [string, string, string];
  motif: CoverMotif;
}

export const SAMPLE_CAMPAIGNS: SampleCampaignDef[] = [
  {
    monthOffset: -1,
    productKey: "sleep",
    theme: "The Sleep Better Launch",
    summary: "A gentle, evergreen health launch: a sleep-habits ebook with a bedtime-routine checklist as the lead magnet and a 14-night tracker bonus. Ideal for wellbeing blogs and newsletters.",
    audience: "busy adults who feel tired and want better sleep without medication",
    outcome: "sleep more deeply and wake up rested",
    problem: "They're tired most days, lie awake with racing thoughts and have tried apps and gadgets that didn't stick.",
    promise: "Sleep Better Tonight helps busy adults build a simple evening routine and get more restful sleep — without gadgets or complicated rules.",
    angle: "Position it as a 'two-week reset': small habits, a simple tracker, and no medical claims.",
    price: 17,
    launchDay: 12,
    access: "member",
    leadMagnet: { title: "The 10-Minute Wind-Down Checklist", format: "Checklist", description: "A one-page evening routine readers can try tonight.", outline: ["Dim the lights after dinner", "Write tomorrow's to-do list", "Phone on charge outside the bedroom", "Ten minutes of something calm", "Same bedtime as last night"] },
    bonuses: [{ title: "14-Night Sleep Tracker", description: "A printable tracker for bedtime, wake time and how rested you feel.", kind: "checklist" }],
    palette: ["#312e81", "#0b0a26", "#a5b4fc"],
    motif: "circles",
  },
  {
    monthOffset: 0,
    productKey: "side-hustle",
    theme: "The Weekend Side Hustle Launch",
    summary: "This month's flagship campaign: a five-lesson mini-course that takes readers from idea to first sale in a weekend, with a workbook bonus and an idea-finder lead magnet.",
    audience: "employees who want extra income and don't know where to start",
    outcome: "turn the skills they already have into a first sale",
    problem: "They've thought about a side hustle for years but feel stuck choosing an idea and worry they don't have the time.",
    promise: "Start a Side Hustle This Weekend helps employees turn skills they already have into a tested offer and a first sale — in a single weekend.",
    angle: "Lean into the weekend: a short, finishable project rather than a life change. Show your own first sale story if you have one.",
    price: 27,
    launchDay: 16,
    access: "member",
    leadMagnet: { title: "The Side Hustle Idea Finder", format: "Worksheet", description: "A one-page worksheet that turns skills and interests into three side-hustle ideas.", outline: ["Ten things people ask you for help with", "Circle the three you'd enjoy", "Start-up cost for each", "Pick one to test this weekend"] },
    bonuses: [
      { title: "Weekend Launch Workbook", description: "Exercises for every lesson, from idea to first customer.", kind: "workbook" },
      { title: "First Customer Checklist", description: "Ten steps to tell people about your offer without feeling pushy.", kind: "checklist" },
    ],
    palette: ["#7e22ce", "#1e0838", "#f0abfc"],
    motif: "grid",
  },
  {
    monthOffset: 1,
    productKey: "budget",
    theme: "The Money Reset Launch",
    summary: "Next month: a budgeting campaign timed for the start of the month, with a 30-day spending tracker bonus.",
    audience: "people who feel anxious about money and want a simple budget they'll actually keep",
    outcome: "build a simple budget they'll actually keep",
    problem: "They've tried budgeting apps and spreadsheets but give up after a week.",
    promise: "Budget Reset helps people build a simple budget they'll keep — in an afternoon.",
    angle: "A calm, judgement-free reset: one afternoon, three numbers, no complicated categories.",
    price: 19,
    launchDay: 3,
    access: "premium",
    leadMagnet: { title: "The Three-Number Budget", format: "Cheat sheet", description: "The simplest budget that works: income, fixed costs and spending money.", outline: ["Write down monthly income", "Add up fixed costs", "What's left is your spending money", "Split it into weeks"] },
    bonuses: [{ title: "30-Day Spending Tracker", description: "A printable daily tracker that takes a minute a day.", kind: "checklist" }],
    palette: ["#0f766e", "#073b36", "#fcd34d"],
    motif: "steps",
  },
];

/* ---------------------------------------- Build Days ---------------------------------------- */

export interface SampleSessionDef {
  title: string;
  kind: SessionKind;
  durationMin: number;
  description: string;
  outcome?: string;
  prompts?: string[];
  resource?: { name: string; content: string } | { title: string; url: string };
}

export interface SampleBuildDayDef {
  /** "past" = last month; "upcoming" = the next Saturday at least four days away. */
  when: "past" | "upcoming";
  title: string;
  theme: string;
  outcome: string;
  host: string;
  access: AccessTier;
  sessions: SampleSessionDef[];
  workbook: { title: string; chapters: { title: string; steps: string[] }[] };
  checklist: { phase: "before" | "during" | "after"; text: string }[];
  actions: { title: string; dueDays: number }[];
  palette: [string, string, string];
  motif: CoverMotif;
}

export const SAMPLE_BUILD_DAYS: SampleBuildDayDef[] = [
  {
    when: "past",
    title: "Email Sequence Sprint",
    theme: "Write and schedule a five-email launch sequence in one day",
    outcome: "Everyone leaves with a five-email launch sequence written, loaded into their email tool and scheduled around their launch date.",
    host: "PLR Profit Lab team",
    access: "member",
    sessions: [
      { title: "Welcome and today's outcome", kind: "welcome", durationMin: 15, description: "What we're writing today and how the sprints work." },
      { title: "The five-email launch formula", kind: "teach", durationMin: 30, description: "Announcement, story, launch, FAQ, excerpt — what each email does and why.", outcome: "A plan for your five emails.", resource: { name: "five-email-formula.md", content: "# The five-email launch formula\n\n1. Announcement — what's coming and when.\n2. Story — why you made it.\n3. Launch — it's available, what's inside, the price.\n4. FAQ — who it's for and who it isn't for.\n5. Excerpt — a genuinely useful piece of the product.\n" } },
      { title: "Sprint 1: emails one to three", kind: "build", durationMin: 60, description: "Write the announcement, story and launch emails.", prompts: ["Paste your best subject line so far."] },
      { title: "Break", kind: "break", durationMin: 15, description: "" },
      { title: "Hot seats: subject lines", kind: "hot-seat", durationMin: 40, description: "Share subject lines and get quick feedback.", prompts: ["Which subject line would you open first?"] },
      { title: "Sprint 2: emails four and five, then schedule", kind: "build", durationMin: 60, description: "Finish the sequence and schedule it in your email tool.", resource: { title: "Email Swipe Builder", url: "/emails" } },
      { title: "Share and commit", kind: "review", durationMin: 20, description: "Share your sequence and your launch date.", prompts: ["What's your launch date?", "Share your win from today."] },
    ],
    workbook: {
      title: "Email Sequence Sprint Workbook",
      chapters: [
        { title: "Before you write", steps: ["Write your product's one-sentence promise.", "List the three questions buyers ask most.", "Choose your launch date."] },
        { title: "Emails one to three", steps: ["Write the announcement email.", "Write the story email.", "Write the launch email with the price and link."] },
        { title: "Emails four and five", steps: ["Answer the top questions in the FAQ email.", "Choose a genuinely useful excerpt for email five.", "Schedule all five emails."] },
      ],
    },
    checklist: [
      { phase: "before", text: "Choose the product you'll write the emails for" },
      { phase: "before", text: "Log in to your email tool" },
      { phase: "during", text: "Emails one to three drafted" },
      { phase: "during", text: "Emails four and five drafted" },
      { phase: "after", text: "Whole sequence scheduled" },
      { phase: "after", text: "Test email sent to yourself" },
    ],
    actions: [
      { title: "Proofread the sequence on your phone", dueDays: 1 },
      { title: "Send yourself the whole sequence as a test", dueDays: 2 },
    ],
    palette: ["#0f766e", "#042f2e", "#fde68a"],
    motif: "waves",
  },
  {
    when: "upcoming",
    title: "Launch-Ready in a Day",
    theme: "Rebrand a PLR product, design the cover and draft the sales page",
    outcome: "Leave with a rebranded product, a finished cover and a first-draft sales page — ready to launch next week.",
    host: "PLR Profit Lab team",
    access: "member",
    sessions: [
      { title: "Welcome and today's outcome", kind: "welcome", durationMin: 15, description: "The three things you'll finish today." },
      { title: "Rebrand in sixty minutes", kind: "teach", durationMin: 30, description: "Import, find-and-replace, rewrite the introduction, add your own examples.", outcome: "A rebrand checklist for your product.", resource: { title: "Rebrand Assistant", url: "/rebrand" } },
      { title: "Sprint 1: rebrand your product", kind: "build", durationMin: 60, description: "Work through the rebrand checklist.", prompts: ["What did you rename your product?"] },
      { title: "Break", kind: "break", durationMin: 15, description: "" },
      { title: "Covers that sell", kind: "teach", durationMin: 20, description: "Readable titles, strong contrast and thumbnail testing.", resource: { name: "cover-checklist.md", content: "# Cover checklist\n\n- [ ] Title readable at thumbnail size\n- [ ] Strong contrast between text and background\n- [ ] One clear image or shape\n- [ ] Your brand colours and fonts\n- [ ] Subtitle states the outcome\n" } },
      { title: "Sprint 2: cover and sales page", kind: "build", durationMin: 70, description: "Design your cover, then draft your sales page from the Campaign Drop copy.", resource: { title: "Sales Page Builder", url: "/sales-pages" } },
      { title: "Hot seats", kind: "hot-seat", durationMin: 30, description: "Share your cover and headline for feedback.", prompts: ["Share your cover and headline."] },
      { title: "Share and commit", kind: "review", durationMin: 15, description: "Set your launch date and your next three actions.", prompts: ["Share your win from today.", "When will you launch?"] },
    ],
    workbook: {
      title: "Launch-Ready in a Day Workbook",
      chapters: [
        { title: "Rebrand", steps: ["Import the PLR into the editor.", "Apply your find-and-replace rules.", "Rewrite the introduction in your own voice.", "Add one example of your own to each chapter."] },
        { title: "Cover", steps: ["Choose a template and apply your brand kit.", "Write a title that states the outcome.", "Check the cover at thumbnail size."] },
        { title: "Sales page", steps: ["Write your headline and subheadline.", "Describe the problem in your buyer's words.", "List what's inside and your bonuses.", "Add your price, guarantee and FAQ."] },
      ],
    },
    checklist: [
      { phase: "before", text: "Download the workbook" },
      { phase: "before", text: "Choose the PLR product you'll rebrand (this month's Campaign Drop works well)" },
      { phase: "before", text: "Set up your brand kit" },
      { phase: "during", text: "Product rebranded" },
      { phase: "during", text: "Cover designed" },
      { phase: "during", text: "Sales page drafted" },
      { phase: "after", text: "Launch date set in your Profit Path" },
    ],
    actions: [
      { title: "Finish any chapter you didn't rebrand", dueDays: 2 },
      { title: "Create a 3D mockup for the sales page", dueDays: 3 },
      { title: "Ask one person to read your sales page", dueDays: 5 },
    ],
    palette: ["#15803d", "#0a140f", "#f2b632"],
    motif: "rays",
  },
];

/* ---------------------------------------- Sample members ---------------------------------------- */

export interface SampleMemberDef {
  displayName: string;
  email: string;
  note: string;
  labTier: AccessTier;
  championTier?: AccessTier;
  profile: {
    experience: Experience;
    hoursPerWeek: number;
    workDays: number[];
    businessModel: BusinessModel;
    launches: number;
    firstLaunchWeek: number;
    niche: string;
    productIdea: string;
    plrProducts: number;
    ownProducts: number;
    hasEmailList: boolean;
    listSize: number;
    hasWebsite: boolean;
    hasCheckout: boolean;
    hasSocialAudience: boolean;
    revenueGoal: number;
    pricePoint: number;
    listGoal: number;
  };
}

export const SAMPLE_MEMBERS: SampleMemberDef[] = [
  {
    displayName: "Jordan (sample member)",
    email: "jordan@sample.profitlab.test",
    note: "Sample Profit Lab member: new, 5 hours a week, building a list with a lead magnet.",
    labTier: "member",
    profile: { experience: "new", hoursPerWeek: 5, workDays: [1, 3, 6], businessModel: "lead-magnet-funnel", launches: 1, firstLaunchWeek: 8, niche: "Busy parents", productIdea: "Calm Family Mornings", plrProducts: 2, ownProducts: 0, hasEmailList: false, listSize: 0, hasWebsite: false, hasCheckout: false, hasSocialAudience: true, revenueGoal: 500, pricePoint: 17, listGoal: 300 },
  },
  {
    displayName: "Alex (sample member)",
    email: "alex@sample.profitlab.test",
    note: "Sample premium member: experienced, 20 hours a week, selling bundles with three launches.",
    labTier: "premium",
    championTier: "premium",
    profile: { experience: "experienced", hoursPerWeek: 20, workDays: [1, 2, 3, 4, 5], businessModel: "bundles", launches: 3, firstLaunchWeek: 4, niche: "Personal finance", productIdea: "The Money Confidence Bundle", plrProducts: 12, ownProducts: 4, hasEmailList: true, listSize: 3200, hasWebsite: true, hasCheckout: true, hasSocialAudience: true, revenueGoal: 6000, pricePoint: 47, listGoal: 4500 },
  },
];
