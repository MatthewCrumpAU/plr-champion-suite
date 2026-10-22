import type { BusinessModel, ProfitPathProfile } from "./types";

/**
 * The 90-Day Profit Path task library.
 *
 * Each stage lists the tasks for one part of the journey. `when` decides whether a task applies to
 * a member (business model, experience, what they already have); `title`/`detail` can read the
 * member's answers. Tasks never promise results — they describe work the member can do.
 */

export type PathPriority = "core" | "recommended" | "stretch";
export const PATH_PRIORITY_LABELS: Record<PathPriority, string> = { core: "Core", recommended: "Recommended", stretch: "Stretch" };

export type PathCategory = "plan" | "learn" | "product" | "marketing" | "launch" | "review" | "growth";
export const PATH_CATEGORY_LABELS: Record<PathCategory, string> = {
  plan: "Planning",
  learn: "Learning",
  product: "Product",
  marketing: "Marketing",
  launch: "Launch",
  review: "Review",
  growth: "Growth",
};

/** Where a task is done. "/x" = studio tool; "member:x" = a page in the current membership area. */
export interface ToolRef {
  label: string;
  href: string;
}

type Text = string | ((p: ProfitPathProfile) => string);

export interface TaskTemplate {
  key: string;
  title: Text;
  detail: Text;
  minutes: number;
  priority: PathPriority | ((p: ProfitPathProfile) => PathPriority);
  category: PathCategory;
  tool?: ToolRef;
  when?: (p: ProfitPathProfile) => boolean;
  /** Launch-week only: work days relative to launch day (0 = launch day). */
  anchor?: number;
}

export type StageId = "foundations" | "create" | "prepare" | "launch" | "review" | "grow" | "next-product" | "final";

export interface StageTemplate {
  id: StageId;
  title: string;
  focus: string;
  milestone: string;
  tasks: TaskTemplate[];
}

const T = {
  niche: { label: "Niche Research", href: "/niche-research" },
  rights: { label: "PLR Rights Review", href: "/rights" },
  brand: { label: "Brand Kits", href: "/brand-kits" },
  editor: { label: "PLR Editor", href: "/editor" },
  rebrand: { label: "Rebrand Assistant", href: "/rebrand" },
  names: { label: "Product Name Generator", href: "/names" },
  covers: { label: "Cover Creator", href: "/covers" },
  mockups: { label: "Mockup Studio", href: "/mockups" },
  builder: { label: "Product Builder", href: "/product-builder" },
  bonus: { label: "Bonus Builder", href: "/bonus-builder" },
  leadMagnet: { label: "Lead Magnet Creator", href: "/lead-magnets" },
  exportCentre: { label: "Export Centre", href: "/export" },
  sales: { label: "Sales Page Builder", href: "/sales-pages" },
  emails: { label: "Email Swipe Builder", href: "/emails" },
  social: { label: "Social Content Creator", href: "/social" },
  profit: { label: "Profit Calculator", href: "/profit" },
  funnels: { label: "Funnel Planner", href: "/funnels" },
  launch: { label: "Launch Planner", href: "/launch" },
  opportunities: { label: "Opportunity Scanner", href: "/opportunities" },
  training: { label: "Training Centre", href: "member:training" },
  campaigns: { label: "Campaign Drops", href: "member:campaigns" },
  buildDays: { label: "Build Days", href: "member:build-days" },
  library: { label: "PLR Champion library", href: "/m/plr-champion/library" },
} satisfies Record<string, ToolRef>;

const is = (...models: BusinessModel[]) => (p: ProfitPathProfile) => models.includes(p.businessModel);
const not = (...models: BusinessModel[]) => (p: ProfitPathProfile) => !models.includes(p.businessModel);
const product = (p: ProfitPathProfile) => p.productIdea.trim() || "your product";
const hours = (p: ProfitPathProfile) => `${p.hoursPerWeek} hour${p.hoursPerWeek === 1 ? "" : "s"}`;

export const STAGES: Record<StageId, StageTemplate> = {
  foundations: {
    id: "foundations",
    title: "Foundations",
    focus: "Choose what you'll sell, to whom, and set up the basics.",
    milestone: "Niche, first product and licence confirmed",
    tasks: [
      { key: "goal", title: "Write down your 90-day goal and why it matters", detail: (p) => `Be specific: ${p.launches === 1 ? "one launch" : `${p.launches} launches`} in 90 days with a ${p.currency} ${p.revenueGoal.toLocaleString()} revenue goal. Keep it where you'll see it every day.`, minutes: 15, priority: "core", category: "plan" },
      { key: "schedule", title: (p) => `Block your ${hours(p)} a week in your calendar`, detail: "Put the sessions in your calendar like appointments. The plan assumes you protect this time.", minutes: 10, priority: "core", category: "plan" },
      { key: "quick-start", title: "Watch the Profit Path quick-start lesson", detail: "A short overview of how the 90 days fit together and how to use each tool.", minutes: 20, priority: "core", category: "learn", tool: T.training, when: (p) => p.experience === "new" },
      {
        key: "niche",
        title: (p) => (p.niche.trim() ? `Confirm your niche: ${p.niche.trim()}` : "Shortlist three niches you could serve"),
        detail: (p) => (p.niche.trim() ? "Write one sentence on who you help and the problem you solve. If it's too broad, narrow it to one group." : "For each, note who buys, what problem they pay to solve and where they hang out online. Pick one."),
        minutes: 40,
        priority: "core",
        category: "plan",
        tool: T.niche,
      },
      {
        key: "pick-plr",
        title: (p) => (p.plrProducts > 0 ? `Choose the best of your ${p.plrProducts} PLR product${p.plrProducts === 1 ? "" : "s"} to launch first` : "Choose a PLR product from the library to launch first"),
        detail: "Pick the one closest to your niche, with a clear outcome and good-quality writing. You'll rebrand and improve it — it doesn't need to be perfect.",
        minutes: 40,
        priority: "core",
        category: "product",
        tool: T.library,
      },
      { key: "licence", title: "Check the licence allows what you plan to do", detail: "Record what the licence allows: editing, selling, giving away, membership use. Never assume resell rights.", minutes: 25, priority: "core", category: "product", tool: T.rights },
      { key: "buyer-problems", title: "List your buyer's five biggest problems", detail: "Use their words. These become your headlines, emails and posts later.", minutes: 40, priority: "recommended", category: "plan", tool: T.niche },
      { key: "brand-kit", title: "Set up your brand kit", detail: "Name, colours, fonts and logo — used by your covers, mockups and sales pages.", minutes: 30, priority: "recommended", category: "product", tool: T.brand },
      { key: "email-tool", title: "Choose and set up an email marketing tool", detail: "Create the account, verify your sending domain and make a first list. You'll need it for your lead magnet and launch emails.", minutes: 60, priority: "core", category: "marketing", when: (p) => !p.hasEmailList },
      { key: "checkout", title: "Set up a way to take payments", detail: "Choose a checkout or digital-delivery platform and connect your payment account so you can sell and deliver files automatically.", minutes: 60, priority: "core", category: "launch", when: (p) => !p.hasCheckout },
      { key: "website", title: "Decide where your sales page will live", detail: "A page builder, your website or your checkout platform's page — choose one and set up the account.", minutes: 30, priority: "core", category: "marketing", when: (p) => !p.hasWebsite },
      { key: "last-numbers", title: "Review your last launch's numbers to set targets", detail: "Visitors, conversion rate, refund rate and list growth. Use them instead of guesses in your goal maths.", minutes: 30, priority: "recommended", category: "review", tool: T.profit, when: (p) => p.ownProducts > 0 },
      { key: "membership-plan", title: "Outline your membership's first three months of content", detail: "Decide what members get each month (e.g. one guide, one workbook, one live call) and which PLR covers it.", minutes: 60, priority: "core", category: "plan", when: is("membership") },
      { key: "sellplr-check", title: "Confirm the licence lets you sell the PLR rights", detail: "Reselling PLR needs explicit permission to sell PLR rights. Check every product you plan to package.", minutes: 20, priority: "core", category: "product", tool: T.rights, when: is("plr-reseller") },
      { key: "bundle-pick", title: "Pick three to five related PLR products for your bundle", detail: "Choose products that solve connected problems for the same buyer, so the bundle makes sense as one purchase.", minutes: 45, priority: "core", category: "product", tool: T.library, when: is("bundles") },
      { key: "service-offer", title: "Decide the coaching or done-for-you offer behind your product", detail: "Who it's for, what you deliver and roughly what it costs. The product will lead buyers to it.", minutes: 45, priority: "core", category: "plan", when: is("services") },
      { key: "lead-magnet-pick", title: "Choose the lead magnet that leads to your product", detail: "A quick win taken from your PLR — a checklist, cheat sheet or short guide — that makes the paid product the obvious next step.", minutes: 30, priority: "core", category: "marketing", tool: T.opportunities, when: is("lead-magnet-funnel") },
    ],
  },
  create: {
    id: "create",
    title: "Create",
    focus: "Turn the PLR into a product that's clearly yours.",
    milestone: "Product edited, rebranded and exported",
    tasks: [
      { key: "import", title: "Import the PLR into the editor and split it into chapters", detail: "Check the chapter split and fix any headings the import missed.", minutes: 30, priority: "core", category: "product", tool: T.editor },
      { key: "intro", title: "Rewrite the introduction in your own voice", detail: "Say who it's for, what they'll be able to do and why you made it. This is the part buyers read first.", minutes: 60, priority: "core", category: "product", tool: T.editor },
      { key: "rebrand", title: "Run the Rebrand Assistant", detail: "Replace the original author, links and brand with yours, and review every change.", minutes: 30, priority: "core", category: "product", tool: T.rebrand },
      { key: "add-value", title: "Add your own examples, stories or updates", detail: "Aim for at least 20% new material — it makes the product yours and keeps it different from other copies of the same PLR.", minutes: 90, priority: "core", category: "product", tool: T.editor },
      { key: "name", title: "Pick a product name and subtitle", detail: (p) => `Make the outcome obvious. Try several options for ${product(p)} and pick the clearest.`, minutes: 30, priority: "core", category: "marketing", tool: T.names },
      { key: "cover", title: "Design your cover", detail: "Use your brand kit. Check it still reads clearly at thumbnail size.", minutes: 45, priority: "core", category: "product", tool: T.covers },
      { key: "mockup", title: "Create a 3D mockup for your sales page", detail: "One hero image plus a bundle shot if you have bonuses.", minutes: 30, priority: "recommended", category: "product", tool: T.mockups },
      { key: "workbook", title: "Turn a chapter into a workbook or checklist bonus", detail: "A practical companion adds value without much extra writing.", minutes: 60, priority: "recommended", category: "product", tool: T.bonus },
      { key: "member-month-1", title: "Create month one of your member content", detail: "Edit and brand the first month's PLR and set it up for members.", minutes: 90, priority: "core", category: "product", tool: T.editor, when: is("membership") },
      { key: "bundle-edit", title: "Edit and brand each product in the bundle", detail: "Consistent covers, names and author details across every product.", minutes: 120, priority: "core", category: "product", tool: T.editor, when: is("bundles") },
      { key: "reseller-package", title: "Package the PLR with a licence certificate", detail: "Include editable files, a clear licence and a short 'what you can do' guide for your buyers.", minutes: 45, priority: "core", category: "product", tool: T.exportCentre, when: is("plr-reseller") },
      { key: "service-outline", title: "Write a one-page outline of your premium offer", detail: "What's included, who it's for and how someone books or applies.", minutes: 60, priority: "core", category: "marketing", when: is("services") },
      { key: "lead-magnet-build", title: "Build your lead magnet from your best chapter", detail: "Keep it short and specific — one quick result that leads to the full product.", minutes: 60, priority: "core", category: "marketing", tool: T.leadMagnet, when: is("lead-magnet-funnel") },
      { key: "proofread", title: "Proofread and export the final files", detail: "Read it once start to finish, then export the DOCX/PDF you'll deliver.", minutes: 45, priority: "core", category: "product", tool: T.exportCentre },
      { key: "video-bonus", title: "Record a short video walkthrough as a bonus", detail: "Five to ten minutes on how to get the most from the product.", minutes: 60, priority: "stretch", category: "product" },
    ],
  },
  prepare: {
    id: "prepare",
    title: "Prepare to launch",
    focus: "Build the page, emails and posts that will sell it.",
    milestone: "Sales page, emails and launch plan ready",
    tasks: [
      { key: "promise", title: "Write your one-sentence promise and who it's for", detail: "“[Product] helps [who] [get what] without [what they want to avoid].” Use it everywhere.", minutes: 30, priority: "core", category: "marketing" },
      { key: "price", title: "Set your price with the Profit Calculator", detail: (p) => `Start from your planned ${p.currency} ${p.pricePoint} and check fees, refunds and break-even.`, minutes: 30, priority: "core", category: "plan", tool: T.profit },
      { key: "sales-page", title: "Draft your sales page", detail: "Headline, problem, what's inside, bonuses, price, guarantee, FAQ. Use the campaign drop copy as a starting point if it fits.", minutes: 120, priority: "core", category: "marketing", tool: T.sales },
      { key: "lead-magnet", title: "Create a lead magnet from one chapter", detail: "A checklist or cheat sheet that solves one small problem and points to the full product.", minutes: 60, priority: (p) => (p.businessModel === "membership" ? "core" : "recommended"), category: "marketing", tool: T.leadMagnet, when: not("lead-magnet-funnel") },
      { key: "optin", title: "Set up your opt-in page and delivery email", detail: "Test it yourself: sign up, receive the email, download the file.", minutes: 60, priority: (p) => (p.businessModel === "lead-magnet-funnel" ? "core" : "recommended"), category: "marketing" },
      { key: "emails", title: "Write your launch email sequence", detail: "Announcement, the story behind it, launch day, FAQ, a useful excerpt and an honest last call.", minutes: 90, priority: "core", category: "marketing", tool: T.emails },
      { key: "social", title: "Plan ten social posts from your chapters", detail: "Mix helpful tips with a few announcements. Schedule them around launch day.", minutes: 60, priority: (p) => (p.hasSocialAudience ? "core" : "recommended"), category: "marketing", tool: T.social },
      { key: "funnel", title: "Map your funnel", detail: "Lead magnet → product → bonus or upgrade. Check every link goes somewhere.", minutes: 40, priority: "recommended", category: "plan", tool: T.funnels },
      { key: "launch-plan", title: "Create your launch plan and dates", detail: "Fix the launch day and work back from it. The plan's launch checklist covers the details.", minutes: 30, priority: "core", category: "launch", tool: T.launch },
      { key: "warm-list", title: (p) => (p.hasEmailList ? `Warm up your list of ${p.listSize.toLocaleString()} with two helpful emails` : "Get your first 25 subscribers"), detail: (p) => (p.hasEmailList ? "Send genuinely useful content before you sell, so the launch email isn't the first thing they've heard from you." : "Share your lead magnet with people in your niche — groups, forums, friends and your social profiles."), minutes: 60, priority: "core", category: "marketing" },
      { key: "test-purchase", title: "Do a test purchase and check delivery", detail: "Buy it yourself (then refund). Check the receipt, download link and every file.", minutes: 30, priority: "core", category: "launch" },
      { key: "service-upgrade", title: "Add a 'next step' link to your coaching or service", detail: "In the product, the thank-you page and the follow-up emails.", minutes: 30, priority: "core", category: "marketing", when: is("services") },
      { key: "member-delivery", title: "Set up member delivery and a test login", detail: "Make sure a new member can sign in and find month one straight away.", minutes: 60, priority: "core", category: "launch", when: is("membership") },
      { key: "partners", title: "Invite three partners or affiliates to promote", detail: "Give them the dates, a swipe email and their link. Only ask people whose audience fits.", minutes: 60, priority: (p) => (p.experience === "experienced" ? "recommended" : "stretch"), category: "growth" },
      { key: "campaign-drop", title: "Check this month's Campaign Drop for copy you can use", detail: "Swipe and adapt the sales copy, emails and posts — rewrite them in your own voice.", minutes: 20, priority: "recommended", category: "marketing", tool: T.campaigns },
    ],
  },
  launch: {
    id: "launch",
    title: "Launch",
    focus: "Open the doors, show up and track what happens.",
    milestone: "Launch is live",
    tasks: [
      { key: "pre-email", title: "Send your pre-launch email", detail: "Tell your list what's coming and when.", minutes: 20, priority: "core", category: "launch", anchor: -1 },
      { key: "final-check", title: "Final check: page, checkout and delivery", detail: "One last test purchase and a read-through on your phone.", minutes: 30, priority: "core", category: "launch", anchor: -1 },
      { key: "open", title: "Launch: publish the page and send the launch email", detail: "Open the doors and send the announcement.", minutes: 45, priority: "core", category: "launch", anchor: 0 },
      { key: "announce", title: "Post your launch announcement on social", detail: "Pin it and reply to every comment.", minutes: 20, priority: "core", category: "launch", anchor: 0 },
      { key: "replies", title: "Reply to questions and comments", detail: "Questions are buying signals — answer them quickly and add the answers to your FAQ.", minutes: 30, priority: "core", category: "launch", anchor: 0 },
      { key: "followup-faq", title: "Send the 'is it right for you?' email", detail: "Who it's for, who it's not for, and your refund policy.", minutes: 20, priority: "core", category: "launch", anchor: 1 },
      { key: "followup-excerpt", title: "Send an email with a useful excerpt from the product", detail: "Give real value so readers can judge the quality for themselves.", minutes: 20, priority: "core", category: "launch", anchor: 2 },
      { key: "track", title: "Record visitors and sales for each launch day", detail: "Write the numbers down daily so you can see what worked.", minutes: 15, priority: "core", category: "review", tool: T.profit, anchor: 3 },
      { key: "live-qa", title: "Host a short live Q&A", detail: "Fifteen minutes answering questions about the product — live or recorded.", minutes: 60, priority: "stretch", category: "launch", anchor: 1 },
    ],
  },
  review: {
    id: "review",
    title: "Review & improve",
    focus: "Learn from the launch while it's fresh.",
    milestone: "Launch reviewed and improvements made",
    tasks: [
      { key: "numbers", title: "Compare your launch numbers with your goal", detail: "Visitors, conversion rate, sales and refunds. Update the Profit Calculator with actual sales.", minutes: 30, priority: "core", category: "review", tool: T.profit },
      { key: "feedback", title: "Ask your buyers for feedback", detail: "What made them buy, and what would make it better? Only share their words with permission.", minutes: 20, priority: "core", category: "review" },
      { key: "lessons", title: "Write down what worked and what to change", detail: "Three things to keep, three things to change next time.", minutes: 15, priority: "core", category: "review" },
      { key: "improve-page", title: "Make three improvements to your sales page", detail: "Add the questions people asked to the FAQ; clarify anything that caused hesitation.", minutes: 60, priority: "recommended", category: "marketing", tool: T.sales },
      { key: "after-purchase", title: "Set up an after-purchase email sequence", detail: "Welcome, quick win, check-in, feedback request.", minutes: 45, priority: "recommended", category: "marketing", tool: T.emails },
    ],
  },
  grow: {
    id: "grow",
    title: "Grow",
    focus: "Keep the product selling between launches.",
    milestone: "Steady promotion running",
    tasks: [
      { key: "list", title: "Share your lead magnet in two new places", detail: "Groups, forums, guest posts or partners your buyers already trust.", minutes: 45, priority: "core", category: "growth" },
      { key: "content", title: "Publish three pieces of content that link to your offer", detail: "Posts, emails or articles drawn from your chapters.", minutes: 90, priority: "core", category: "growth", tool: T.social },
      { key: "member-content", title: "Publish this week's member content", detail: "Keep the promise you made to members — on time, every time.", minutes: 60, priority: "core", category: "product", when: is("membership") },
      { key: "repurpose", title: "Repurpose one chapter into posts and emails", detail: "One chapter can become a week of content.", minutes: 60, priority: "recommended", category: "growth", tool: T.social },
      { key: "evergreen", title: "Turn your launch emails into an evergreen sequence", detail: "So new subscribers see the offer automatically.", minutes: 60, priority: "recommended", category: "marketing", tool: T.emails },
      { key: "partners", title: "Reach out to three potential partners", detail: "Newsletters, podcasts or creators with the same audience.", minutes: 45, priority: "recommended", category: "growth" },
      { key: "bundle-deal", title: "Create a bundle or upgrade offer", detail: "Pair your product with a related one for a higher-value option.", minutes: 60, priority: (p) => (p.businessModel === "bundles" ? "core" : "stretch"), category: "product" },
      { key: "build-day", title: "Join or catch up on this month's Build Day", detail: "Use the session to finish your next build sprint.", minutes: 60, priority: "stretch", category: "learn", tool: T.buildDays },
    ],
  },
  "next-product": {
    id: "next-product",
    title: "Next product",
    focus: "Get your next product ready, faster than the first.",
    milestone: "Next product ready to launch",
    tasks: [
      { key: "choose", title: "Choose your next PLR product", detail: "Something your first buyers would want next.", minutes: 30, priority: "core", category: "product", tool: T.library },
      { key: "licence", title: "Check its licence", detail: "Same rules as before — record what it allows.", minutes: 15, priority: "core", category: "product", tool: T.rights },
      { key: "edit", title: "Edit and rebrand it", detail: "Reuse your rebrand rules and brand kit from the first product.", minutes: 120, priority: "core", category: "product", tool: T.editor },
      { key: "cover", title: "Cover and mockup", detail: "Match the style of your first product so they look like a range.", minutes: 60, priority: "core", category: "product", tool: T.covers },
      { key: "page", title: "Adapt your sales page", detail: "Duplicate the first one and rewrite it for the new product.", minutes: 60, priority: "core", category: "marketing", tool: T.sales },
      { key: "emails", title: "Write three launch emails", detail: "Announcement, launch day and a last call.", minutes: 60, priority: "core", category: "marketing", tool: T.emails },
      { key: "tell-buyers", title: "Tell your existing buyers it's coming", detail: "They already trust you — give them first look.", minutes: 20, priority: "recommended", category: "marketing" },
    ],
  },
  final: {
    id: "final",
    title: "90-day review",
    focus: "Look back, back up and plan the next 90 days.",
    milestone: "90 days complete and next plan set",
    tasks: [
      { key: "review", title: "Review your 90 days: revenue, list and products", detail: (p) => `Compare with your goals: ${p.currency} ${p.revenueGoal.toLocaleString()} revenue and ${p.listGoal.toLocaleString()} subscribers.`, minutes: 45, priority: "core", category: "review", tool: T.profit },
      { key: "backup", title: "Back up your projects", detail: "Download a workspace backup from the Export Centre.", minutes: 10, priority: "core", category: "plan", tool: T.exportCentre },
      { key: "next-plan", title: "Plan your next 90 days", detail: "Keep what worked, drop what didn't, and set your next launch dates.", minutes: 45, priority: "core", category: "plan" },
      { key: "celebrate", title: "Celebrate what you've built", detail: "List everything you created and shipped. It's more than you think.", minutes: 10, priority: "core", category: "review" },
    ],
  },
};

/* ------------------------------------------------------------------------------------------ */
/* Launch checklists                                                                            */
/* ------------------------------------------------------------------------------------------ */

export interface LaunchChecklistTemplate {
  key: string;
  text: string;
  when?: (p: ProfitPathProfile) => boolean;
}

export const LAUNCH_CHECKLIST: { id: "before" | "day" | "after"; title: string; items: LaunchChecklistTemplate[] }[] = [
  {
    id: "before",
    title: "Seven days before",
    items: [
      { key: "page-proof", text: "Sales page proofread and checked on a phone" },
      { key: "price-set", text: "Price, guarantee and refund policy on the page" },
      { key: "checkout-test", text: "Test purchase completed and refunded" },
      { key: "delivery", text: "Delivery email and every download link tested" },
      { key: "licence", text: "Licence checked for everything you're selling or giving away" },
      { key: "emails-scheduled", text: "Launch emails written and scheduled" },
      { key: "posts-scheduled", text: "Launch posts written and scheduled" },
      { key: "lead-magnet", text: "Lead magnet live and delivering" },
      { key: "tracking", text: "Visitor and sales tracking working" },
      { key: "support", text: "Support email or help page ready" },
      { key: "member-login", text: "Member area tested with a test login", when: (p) => p.businessModel === "membership" },
      { key: "bundle-files", text: "Every product in the bundle included in the download", when: (p) => p.businessModel === "bundles" },
      { key: "licence-cert", text: "Licence certificate included in the PLR package", when: (p) => p.businessModel === "plr-reseller" },
      { key: "booking", text: "Booking or application link tested", when: (p) => p.businessModel === "services" },
      { key: "funnel-test", text: "Opt-in → delivery → offer sequence tested end to end", when: (p) => p.businessModel === "lead-magnet-funnel" },
    ],
  },
  {
    id: "day",
    title: "Launch day",
    items: [
      { key: "open", text: "Page published and checkout open" },
      { key: "email", text: "Launch email sent" },
      { key: "post", text: "Announcement posted and pinned" },
      { key: "first-order", text: "First order delivered correctly" },
      { key: "replies", text: "Questions and comments answered" },
      { key: "numbers", text: "Day-one numbers recorded" },
    ],
  },
  {
    id: "after",
    title: "After launch",
    items: [
      { key: "followups", text: "Follow-up emails sent" },
      { key: "welcome", text: "Buyers welcomed with a quick-start email" },
      { key: "feedback", text: "Feedback requested from buyers" },
      { key: "faq", text: "Sales page FAQ updated with real questions" },
      { key: "actuals", text: "Actual sales recorded in the Profit Calculator" },
      { key: "next", text: "Next promotion date chosen" },
    ],
  },
];
