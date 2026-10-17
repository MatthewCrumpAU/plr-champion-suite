import type { CoverMotif } from "./covers";
import type { AccessTier, CourseKind, CourseLevel, LessonType, LicenceRightKey, LicenceType, ProductFormat, ResourceType, RightValue } from "./types";

/**
 * Sample library for private testing. All text is original demonstration content written for
 * PLR Champion — it is not third-party PLR. Everything seeded from here is flagged `isSample` so it
 * can be removed in one click from Membership Admin → Data.
 */

export interface SampleChapter {
  title: string;
  paras: string[];
  points?: string[];
  steps?: string[];
}

export type SampleFileSpec = "ebook-docx" | "ebook-pdf" | "workbook-docx" | "checklist-pdf" | "sales-md" | "emails-txt";

export interface SampleProductDef {
  key: string;
  title: string;
  subtitle: string;
  format: ProductFormat;
  categories: string[];
  tags: string[];
  access: AccessTier;
  /** Index into the brand's sample drops, or null for evergreen library items. */
  drop: number | null;
  status?: "published" | "draft";
  featured?: boolean;
  licence: LicenceType;
  licenceTerms: string;
  licenceOverrides?: Partial<Record<LicenceRightKey, RightValue>>;
  palette: [string, string, string];
  motif: CoverMotif;
  description: string;
  highlights: string[];
  chapters: SampleChapter[];
  files: SampleFileSpec[];
}

export interface SampleCategoryDef {
  key: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

export interface SampleDropDef {
  /** Months relative to the current month (0 = this month). Future drops are scheduled. */
  monthOffset: number;
  theme: string;
  description: string;
  palette: [string, string, string];
  motif: CoverMotif;
}

export interface SampleLessonDef {
  title: string;
  type: LessonType;
  durationMin: number;
  body: string;
  /** A generated text attachment (file name → content). */
  attachment?: { name: string; content: string };
}

export interface SampleCourseDef {
  key: string;
  kind: CourseKind;
  title: string;
  summary: string;
  level: CourseLevel;
  toolHint: string | null;
  access: AccessTier;
  palette: [string, string, string];
  motif: CoverMotif;
  modules: { title: string; lessons: SampleLessonDef[] }[];
}

export interface SampleResourceDef {
  title: string;
  description: string;
  type: ResourceType;
  access: AccessTier;
  file?: { name: string; content: string };
  url?: string;
}

export interface SampleLibrary {
  categories: SampleCategoryDef[];
  drops: SampleDropDef[];
  products: SampleProductDef[];
  courses: SampleCourseDef[];
  resources: SampleResourceDef[];
}

export const PLR_LICENCE_TERMS =
  "You may edit, rebrand and sell the finished product, use it as a bonus or lead magnet, and break it into articles, emails and posts. You may not sell, give away or share the PLR rights themselves, or offer the original unedited files as a free download. Adding the content to a paid membership is allowed only after you have rewritten at least 30% of it.";
export const MRR_LICENCE_TERMS =
  "You may sell this product unchanged and pass resell rights on to your buyers. Do not edit the content, add your name as author or give it away. Minimum selling price: US$7.";

/* ------------------------------------------------------------------------------------------ */
/* PLR Champion sample library                                                                 */
/* ------------------------------------------------------------------------------------------ */
export const CHAMPION_SAMPLE: SampleLibrary = {
  categories: [
    { key: "health", name: "Health & Wellness", description: "Sleep, nutrition, energy and everyday wellbeing.", icon: "heart-pulse", color: "#10b981" },
    { key: "selfhelp", name: "Personal Development", description: "Habits, confidence, mindset and growth.", icon: "sparkles", color: "#8b5cf6" },
    { key: "business", name: "Business & Productivity", description: "Work smarter, start something, get more done.", icon: "briefcase", color: "#5b4df5" },
    { key: "money", name: "Money & Finance", description: "Budgeting, saving and money confidence.", icon: "piggy-bank", color: "#f59e0b" },
    { key: "family", name: "Relationships & Family", description: "Parenting, relationships and family life.", icon: "users", color: "#ec4899" },
    { key: "home", name: "Home & Lifestyle", description: "Home, food, organising and simple living.", icon: "home", color: "#0ea5e9" },
  ],
  drops: [
    { monthOffset: -2, theme: "Fresh Start Habits", description: "Three products on routines, gratitude and confidence — perfect for new-year and back-to-school promotions.", palette: ["#3b2fd0", "#1b1660", "#f5b544"], motif: "rays" },
    { monthOffset: -1, theme: "Money Confidence", description: "Budgeting, smart grocery savings and a money-mindset ebook with an email series ready to go.", palette: ["#0f766e", "#073b36", "#fcd34d"], motif: "steps" },
    { monthOffset: 0, theme: "Healthy Home", description: "Meal prep, better sleep and a room-by-room declutter guide — strong evergreen niches with easy bonus ideas.", palette: ["#0369a1", "#0b2440", "#7dd3fc"], motif: "waves" },
    { monthOffset: 1, theme: "Side Hustle Season", description: "A complete mini-course on starting a weekend side hustle, with a workbook and launch emails.", palette: ["#9333ea", "#2e1065", "#f9a8d4"], motif: "grid" },
  ],
  products: [
    {
      key: "calm-morning",
      title: "The Calm Morning Method",
      subtitle: "Build a 20-minute morning routine that sets up your whole day",
      format: "ebook",
      categories: ["selfhelp", "health"],
      tags: ["morning routine", "habits", "mindfulness", "productivity"],
      access: "member",
      drop: 0,
      featured: true,
      licence: "plr",
      licenceTerms: PLR_LICENCE_TERMS,
      palette: ["#f97316", "#7c2d12", "#fde68a"],
      motif: "rays",
      description:
        "Most people start the day reacting — to alarms, messages and other people's priorities. **The Calm Morning Method** shows readers how to take back the first 20 minutes of the day with a simple, flexible routine they will actually keep.\n\nIt's written in a warm, practical voice and works brilliantly as a front-end product, a lead magnet (with the workbook as a bonus) or a module inside a wellbeing membership.\n\n**Perfect for:** wellbeing coaches, productivity blogs, journaling and planner sellers.",
      highlights: ["5 short chapters with action steps", "Companion workbook with prompts for every chapter", "Ready-made sales page copy", "Editable DOCX plus a print-ready PDF"],
      files: ["ebook-docx", "ebook-pdf", "workbook-docx", "sales-md"],
      chapters: [
        {
          title: "Introduction: Why Mornings Matter",
          paras: [
            "The way you spend the first part of your morning has a quiet but powerful effect on the rest of your day. Start in a rush and you spend hours trying to catch up. Start calmly and with intention, and even a busy day feels more manageable.",
            "This guide is not about waking at 5am or copying a celebrity routine. It is about designing a short, realistic morning that fits your life — one you can keep on tired days as well as good ones.",
          ],
          points: ["A calm start lowers stress for the rest of the day", "Small, repeatable actions beat ambitious plans", "Your routine should fit your life, not someone else's"],
        },
        {
          title: "Chapter 1: Start the Night Before",
          paras: [
            "A calm morning begins the evening before. When you make a few decisions in advance — what to wear, what to eat, what matters most tomorrow — you wake up with fewer choices competing for your attention.",
            "Spend ten minutes each evening resetting your space and writing down tomorrow's single most important task. It sounds simple because it is, and it works.",
          ],
          points: ["Lay out clothes and pack bags", "Write tomorrow's one important task", "Set a consistent wind-down time"],
          steps: ["Choose a 'last call' time for screens tonight.", "Write tomorrow's most important task on a sticky note.", "Reset one surface in your home before bed."],
        },
        {
          title: "Chapter 2: The First Five Minutes",
          paras: [
            "What you do in the first five minutes after waking sets the tone. Reaching straight for your phone hands your attention to other people before you have had a chance to decide how you feel.",
            "Instead, try a short sequence: a glass of water, open the curtains for daylight, and three slow breaths. None of these take effort, but together they tell your body and mind that the day has started on your terms.",
          ],
          points: ["Keep your phone out of reach for the first five minutes", "Hydrate and get daylight", "Breathe slowly before you plan"],
          steps: ["Move your phone charger out of the bedroom.", "Put a glass by the sink tonight.", "Practise three slow breaths after waking tomorrow."],
        },
        {
          title: "Chapter 3: Build Your 20-Minute Routine",
          paras: [
            "A good routine has three parts: something for your body, something for your mind and something for your direction. A short stretch or walk, a few minutes of quiet or journaling, and a quick look at your plan for the day.",
            "Start with the smallest version you can do every day. Once it feels automatic, you can extend it. Consistency matters far more than duration.",
          ],
          points: ["Body: stretch, walk or move for five minutes", "Mind: quiet, prayer, reading or journaling", "Direction: review your one important task"],
          steps: ["Choose one activity for each part.", "Write your routine on a card and keep it visible.", "Do the routine for seven days before changing it."],
        },
        {
          title: "Chapter 4: Keeping It Going",
          paras: [
            "Every routine breaks eventually — a sick child, travel, a late night. The people who keep their routines are not the ones who never miss; they are the ones who return quickly.",
            "Have a 'minimum routine' for hard days: one glass of water and one minute of quiet. It keeps the habit alive until normal life returns.",
          ],
          points: ["Plan a two-minute minimum routine", "Never miss twice in a row", "Review and adjust every month"],
          steps: ["Write your minimum routine under your full routine.", "Mark each completed morning on a calendar.", "Set a monthly reminder to review what is working."],
        },
      ],
    },
    {
      key: "gratitude",
      title: "Gratitude Journal Starter",
      subtitle: "30 days of prompts to notice the good and feel more content",
      format: "workbook",
      categories: ["selfhelp"],
      tags: ["gratitude", "journaling", "wellbeing", "lead magnet"],
      access: "free",
      drop: 0,
      licence: "plr",
      licenceTerms: PLR_LICENCE_TERMS,
      palette: ["#db2777", "#500724", "#fbcfe8"],
      motif: "circles",
      description:
        "A short, beautiful workbook that walks readers through 30 days of gratitude journaling. Each week has a theme and simple prompts that take less than five minutes.\n\nIt's ideal as an opt-in gift: short enough to finish, valuable enough to build trust, and easy to rebrand with your own colours and logo.\n\n**Perfect for:** list building, wellbeing communities, printable shops.",
      highlights: ["30 daily prompts in four weekly themes", "Designed as a lead magnet", "Editable DOCX workbook", "Free-tier sample so you can test access rules"],
      files: ["workbook-docx", "sales-md"],
      chapters: [
        {
          title: "How to Use This Journal",
          paras: ["Set aside five minutes at the same time each day. Read the prompt, write whatever comes to mind and stop when the time is up. There are no wrong answers.", "If you miss a day, simply pick up with the next prompt. The goal is noticing, not perfection."],
          points: ["Five minutes a day", "Same time, same place", "Honest, not perfect"],
        },
        {
          title: "Week 1: Everyday Moments",
          paras: ["This week focuses on the small, ordinary things that are easy to overlook: a warm drink, a kind message, a quiet moment."],
          points: ["What made you smile today?", "Which ordinary object would you miss most?", "Describe a small comfort you enjoyed this week."],
          steps: ["Write three things you noticed today.", "Thank one person by message.", "Take a photo of something you appreciate."],
        },
        {
          title: "Week 2: People",
          paras: ["Gratitude grows when we notice the people around us. This week is about friends, family, colleagues and strangers who made a difference."],
          points: ["Who taught you something important?", "Who could you thank this week?", "Describe a time someone helped without being asked."],
          steps: ["Write a short thank-you note.", "Call someone you have not spoken to in a while.", "Notice one kindness from a stranger."],
        },
        {
          title: "Week 3 and 4: Growth and Looking Ahead",
          paras: ["The final fortnight turns gratitude inward and forward: the challenges that taught you something, and the things you are looking forward to."],
          points: ["What difficulty made you stronger?", "Which skill are you glad you learned?", "What are you looking forward to this month?"],
          steps: ["List three strengths you are grateful for.", "Write a letter to yourself one year from now.", "Choose one gratitude habit to keep."],
        },
      ],
    },
    {
      key: "speaking",
      title: "Confident Public Speaking",
      subtitle: "Calm your nerves and speak with clarity in any room",
      format: "ebook",
      categories: ["selfhelp", "business"],
      tags: ["confidence", "public speaking", "career", "communication"],
      access: "premium",
      drop: 0,
      licence: "plr",
      licenceTerms: PLR_LICENCE_TERMS,
      palette: ["#1e3a8a", "#0b1226", "#60a5fa"],
      motif: "steps",
      description:
        "Fear of public speaking is one of the most common worries there is — which makes it a large, motivated market. This guide gives readers a practical system for preparing, practising and delivering talks without freezing up.\n\nIncludes a one-page preparation checklist that makes a perfect bonus or upsell.\n\n**Perfect for:** career coaches, business blogs, Toastmasters-style communities.",
      highlights: ["4 practical chapters", "Speech preparation checklist (PDF)", "Premium-tier sample product", "Easy to expand into a mini-course"],
      files: ["ebook-docx", "checklist-pdf"],
      chapters: [
        {
          title: "Chapter 1: Understanding the Nerves",
          paras: ["Nerves are your body preparing to perform. The racing heart and shaky hands are the same response athletes feel before a race. The goal is not to remove them but to work with them.", "Most audiences want you to succeed. They are not looking for mistakes; they are hoping to learn something or be entertained."],
          points: ["Nerves are normal and useful", "Audiences are on your side", "Preparation reduces fear more than anything else"],
          steps: ["Write down what you fear most about speaking.", "Next to each fear, write what you would do if it happened.", "Practise slow breathing for two minutes."],
        },
        {
          title: "Chapter 2: Preparing a Clear Message",
          paras: ["A confident talk starts with a clear message. If you cannot say your main point in one sentence, your audience will not be able to either.", "Build your talk around three supporting points, each with a story or example. Stories are easier to remember — for you and for your listeners."],
          points: ["One main message", "Three supporting points", "A story for each point"],
          steps: ["Write your main message in one sentence.", "Choose three supporting points.", "Find a short story or example for each."],
        },
        {
          title: "Chapter 3: Practise Like a Pro",
          paras: ["Practise out loud, standing up, as if the audience were there. Reading silently is not practice. Record yourself on your phone and watch it back once — just once — for the biggest improvement you can make.", "Practise your opening and closing the most. A strong start calms your nerves, and a strong finish is what people remember."],
          points: ["Practise out loud, standing", "Record and review once", "Over-prepare the opening and close"],
          steps: ["Rehearse the full talk three times.", "Record one run-through.", "Memorise your first and last sentences."],
        },
        {
          title: "Chapter 4: On the Day",
          paras: ["Arrive early, check the room and talk to a few audience members before you start. Friendly faces make the room feel smaller.", "Pause before your first sentence, speak slower than feels natural and look at one person at a time. If you lose your place, pause, check your notes and carry on — nobody minds."],
          points: ["Arrive early and meet people", "Pause, then speak slowly", "Recover calmly from mistakes"],
          steps: ["Pack water and your notes the night before.", "Plan a two-minute calming routine for backstage.", "Ask one trusted person for feedback afterwards."],
        },
      ],
    },
    {
      key: "budget",
      title: "Budget Reset in 30 Days",
      subtitle: "A simple, judgement-free plan to take control of your money",
      format: "ebook",
      categories: ["money"],
      tags: ["budgeting", "personal finance", "saving", "money"],
      access: "member",
      drop: 1,
      featured: true,
      licence: "plr",
      licenceTerms: PLR_LICENCE_TERMS,
      palette: ["#047857", "#022c22", "#fcd34d"],
      motif: "steps",
      description:
        "Budgeting advice is often either too complicated or too strict. **Budget Reset in 30 Days** gives readers a four-week plan that starts with understanding where money goes and ends with a budget they can live with.\n\nComes with a workbook of trackers and reflection pages, plus sales copy.\n\n**Perfect for:** personal finance blogs, debt-free communities, money coaches.",
      highlights: ["Four-week step-by-step plan", "Workbook with weekly trackers", "Sales page copy included", "No jargon, no shaming"],
      files: ["ebook-docx", "workbook-docx", "sales-md"],
      chapters: [
        {
          title: "Week 1: See Where Your Money Goes",
          paras: ["You cannot change what you cannot see. This week, simply track every purchase without judging it. Use a notebook, a spreadsheet or your banking app — whatever you will actually keep up.", "At the end of the week, group your spending into a few simple categories. Most people are surprised by at least one of them."],
          points: ["Track everything for seven days", "Don't judge, just notice", "Group spending into simple categories"],
          steps: ["Choose your tracking method today.", "Record every purchase for seven days.", "Total each category on day seven."],
        },
        {
          title: "Week 2: Separate Needs, Wants and Goals",
          paras: ["Now sort your spending into needs (housing, food, bills), wants (things you enjoy) and goals (savings, debt repayment). There is room for all three in a healthy budget.", "The aim is not to remove every want. It is to make sure your wants are chosen on purpose, not by habit."],
          points: ["Needs keep life running", "Wants make life enjoyable", "Goals build your future"],
          steps: ["Label last week's spending as need, want or goal.", "Choose one want you would happily give up.", "Pick one savings goal for this month."],
        },
        {
          title: "Week 3: Build Your Budget",
          paras: ["Give every dollar of your income a job before the month starts. Start with needs, then goals, then wants. If the numbers don't fit, adjust wants first.", "Keep a small 'buffer' category for the unexpected. It's the difference between a budget that breaks and one that bends."],
          points: ["Plan income before you spend it", "Needs, then goals, then wants", "Always include a buffer"],
          steps: ["List your monthly income.", "Assign amounts to each category.", "Add a buffer of at least 5%."],
        },
        {
          title: "Week 4: Make It Stick",
          paras: ["A budget is a living plan. Set a weekly 15-minute money check-in to compare what you planned with what happened, and adjust without guilt.", "Celebrate progress. Moving even a small amount towards a goal is a win worth noticing."],
          points: ["Weekly 15-minute check-in", "Adjust, don't abandon", "Celebrate small wins"],
          steps: ["Schedule a weekly money check-in.", "Automate one savings transfer.", "Write down your first budget win."],
        },
      ],
    },
    {
      key: "grocery",
      title: "Smart Grocery Savings",
      subtitle: "Cut your food bill without eating worse",
      format: "checklist",
      categories: ["money", "home"],
      tags: ["groceries", "saving money", "meal planning", "frugal"],
      access: "member",
      drop: 1,
      licence: "plr",
      licenceTerms: PLR_LICENCE_TERMS,
      palette: ["#65a30d", "#1a2e05", "#fef08a"],
      motif: "leaves",
      description:
        "Food is one of the easiest household costs to reduce. This short guide and printable checklist show readers how to plan, shop and store food to save money every week.\n\nShort, practical and great as a bonus for any budgeting or meal-planning product.\n\n**Perfect for:** frugal living blogs, family audiences, meal-planning products.",
      highlights: ["Printable shopping checklist (PDF)", "Short companion guide", "Great bonus for budgeting products"],
      files: ["checklist-pdf", "ebook-docx"],
      chapters: [
        {
          title: "Plan Before You Shop",
          paras: ["The biggest savings happen before you reach the shop. Check what you already have, plan meals around it, and write a list grouped by aisle."],
          points: ["Check the fridge, freezer and pantry first", "Plan meals around what needs using", "Write a list and stick to it"],
          steps: ["Do a five-minute kitchen check.", "Plan five dinners.", "Write your list by aisle."],
        },
        {
          title: "Shop Smarter",
          paras: ["Shop after eating, compare unit prices and try store brands for staples. Buy in bulk only what you will use before it spoils."],
          points: ["Never shop hungry", "Compare unit prices, not packet prices", "Try store brands for staples"],
          steps: ["Swap three branded staples for store brands.", "Check unit prices on your top five items.", "Set a spending limit before you go."],
        },
        {
          title: "Store and Use Everything",
          paras: ["Food waste is money in the bin. Store produce properly, freeze leftovers and plan one 'use it up' meal each week."],
          points: ["First in, first out", "Freeze before it spoils", "One use-it-up meal each week"],
          steps: ["Move older food to the front of the fridge.", "Label and date freezer containers.", "Plan this week's use-it-up meal."],
        },
      ],
    },
    {
      key: "money-mindset",
      title: "Money Mindset Makeover",
      subtitle: "Change the money stories that hold you back",
      format: "ebook",
      categories: ["money", "selfhelp"],
      tags: ["money mindset", "abundance", "beliefs", "email series"],
      access: "premium",
      drop: 1,
      licence: "plr",
      licenceTerms: PLR_LICENCE_TERMS,
      palette: ["#b45309", "#3b1d06", "#fde68a"],
      motif: "circles",
      description:
        "Our beliefs about money — often picked up in childhood — shape every financial decision. This ebook helps readers spot their money stories, question them and build healthier habits.\n\nIncludes a five-email follow-up series you can load into your autoresponder.\n\n**Perfect for:** money coaches, personal growth brands, financial wellbeing courses.",
      highlights: ["4 chapters with reflection exercises", "5-email follow-up series", "DOCX and PDF versions"],
      files: ["ebook-docx", "ebook-pdf", "emails-txt"],
      chapters: [
        {
          title: "Chapter 1: Your Money Story",
          paras: ["Everyone has a money story — the beliefs we learned from family, friends and experience. Some help us; others quietly hold us back.", "The first step is to notice yours. What did you hear about money growing up? What do you believe about people who have plenty of it?"],
          points: ["Money beliefs are learned", "Some beliefs help, some limit", "Noticing is the first step"],
          steps: ["Write three things you heard about money as a child.", "Mark each as helpful or limiting.", "Choose one to explore this week."],
        },
        {
          title: "Chapter 2: Questioning Old Beliefs",
          paras: ["A belief is not a fact. For each limiting belief, ask: is this always true? Where is the evidence against it? What would I do if I didn't believe it?"],
          points: ["Beliefs can be tested", "Look for evidence against them", "Imagine acting without them"],
          steps: ["Pick one limiting belief.", "List three pieces of evidence against it.", "Write a more balanced replacement belief."],
        },
        {
          title: "Chapter 3: New Habits, New Results",
          paras: ["Mindset changes stick when they are backed by action. Small, regular money habits — checking your balance, saving a little, learning one new idea — build confidence fast."],
          points: ["Act on new beliefs", "Small habits build confidence", "Track progress to prove change"],
          steps: ["Check your balances every Monday.", "Automate a small weekly saving.", "Read one money article each week."],
        },
        {
          title: "Chapter 4: Staying on Track",
          paras: ["Old stories return under stress. Have a plan for when they do: pause, name the story, and choose your next small action anyway."],
          points: ["Expect old stories to return", "Name them when they do", "Keep taking small actions"],
          steps: ["Write your 'pause and name it' reminder.", "Find an accountability partner.", "Review your progress monthly."],
        },
      ],
    },
    {
      key: "meal-prep",
      title: "Simple Meal Prep for Busy Families",
      subtitle: "Two hours on Sunday, healthy dinners all week",
      format: "ebook",
      categories: ["health", "family", "home"],
      tags: ["meal prep", "family dinners", "healthy eating", "time saving"],
      access: "member",
      drop: 2,
      featured: true,
      licence: "plr",
      licenceTerms: PLR_LICENCE_TERMS,
      palette: ["#dc2626", "#450a0a", "#fdba74"],
      motif: "leaves",
      description:
        "Weeknight dinners are a daily stress for busy families. This guide shows readers how to spend two focused hours on the weekend preparing ingredients and meals that make weeknights easy.\n\nIncludes a printable prep-day checklist and sales copy.\n\n**Perfect for:** family blogs, healthy-eating brands, recipe and planner sellers.",
      highlights: ["Step-by-step prep-day plan", "Printable prep checklist (PDF)", "Sales page copy included"],
      files: ["ebook-docx", "checklist-pdf", "sales-md"],
      chapters: [
        {
          title: "Chapter 1: Why Meal Prep Works",
          paras: ["Meal prep moves the hardest part of cooking — deciding and chopping — to a time when you have energy. On weeknights you simply assemble and heat.", "Families who prep save money, eat more vegetables and spend less time arguing about what's for dinner."],
          points: ["Decide once, eat all week", "Less waste, lower bills", "Calmer weeknights"],
          steps: ["Pick your prep day and time.", "Ask each family member for one favourite meal.", "Clear fridge space for containers."],
        },
        {
          title: "Chapter 2: Plan Your Week",
          paras: ["Choose four or five dinners that share ingredients. Roast vegetables can become a pasta sauce, a salad and a soup; cooked chicken can become wraps and a stir-fry."],
          points: ["Overlap ingredients", "Mix quick and slow meals", "Plan one leftover night"],
          steps: ["Choose five dinners.", "Highlight shared ingredients.", "Write one combined shopping list."],
        },
        {
          title: "Chapter 3: Prep Day, Step by Step",
          paras: ["Start with whatever takes longest — rice, roasting trays, slow-cooked dishes. While they cook, wash and chop vegetables, mix sauces and portion snacks."],
          points: ["Longest cooking first", "Chop while things cook", "Cool food before refrigerating"],
          steps: ["Preheat the oven and start grains first.", "Chop all vegetables in one session.", "Label containers with the day they're for."],
        },
        {
          title: "Chapter 4: Storing and Serving",
          paras: ["Most prepared food keeps three to four days in the fridge. Freeze meals for later in the week, and keep sauces separate so food stays fresh."],
          points: ["Fridge for days 1–3", "Freezer for days 4–5", "Keep sauces separate"],
          steps: ["Move Thursday and Friday meals to the freezer.", "Set a reminder to defrost the night before.", "Note what worked for next week."],
        },
      ],
    },
    {
      key: "sleep",
      title: "Sleep Better Tonight",
      subtitle: "Practical habits for deeper, more restful sleep",
      format: "ebook",
      categories: ["health"],
      tags: ["sleep", "health", "evening routine", "stress"],
      access: "member",
      drop: 2,
      licence: "plr",
      licenceTerms: PLR_LICENCE_TERMS,
      palette: ["#312e81", "#0b0a26", "#a5b4fc"],
      motif: "circles",
      description:
        "Almost everyone wants better sleep, which makes this one of the most dependable evergreen niches. This guide covers the evening routine, bedroom set-up and daytime habits that make the biggest difference.\n\n*General wellbeing information only — not medical advice.*\n\n**Perfect for:** health blogs, wellbeing memberships, product bundles.",
      highlights: ["4 chapters of practical habits", "DOCX and print-ready PDF", "Evergreen niche"],
      files: ["ebook-docx", "ebook-pdf"],
      chapters: [
        {
          title: "Chapter 1: Your Sleep Window",
          paras: ["Going to bed and waking at roughly the same time each day — including weekends — is one of the most effective sleep habits there is.", "Choose a realistic wake-up time, then count back to find a bedtime that gives you enough rest."],
          points: ["Consistent wake time", "Realistic bedtime", "Weekends count too"],
          steps: ["Choose your wake time.", "Set a bedtime reminder.", "Keep it for two weeks."],
        },
        {
          title: "Chapter 2: The Wind-Down Hour",
          paras: ["Your brain needs a runway to land. Dim the lights, put screens away and do something calm for the last hour before bed."],
          points: ["Dim lights after dinner", "Screens away an hour before bed", "A calm, repeatable ritual"],
          steps: ["Choose three wind-down activities.", "Charge your phone outside the bedroom.", "Write tomorrow's to-do list before you wind down."],
        },
        {
          title: "Chapter 3: Set Up Your Bedroom",
          paras: ["A cool, dark, quiet room helps you fall asleep and stay asleep. Small changes — blackout curtains, a fan, a comfortable pillow — add up."],
          points: ["Cool, dark and quiet", "Bed is for sleep", "Remove clutter and screens"],
          steps: ["Block light from windows and devices.", "Check your room temperature.", "Clear the bedside table."],
        },
        {
          title: "Chapter 4: Daytime Habits That Help",
          paras: ["Good nights start in the day: morning daylight, regular movement, and keeping caffeine to the morning all make sleep easier."],
          points: ["Morning daylight", "Move every day", "Caffeine before midday"],
          steps: ["Get outside within an hour of waking.", "Take a short walk after lunch.", "Switch to decaf after midday."],
        },
      ],
    },
    {
      key: "declutter",
      title: "Declutter Your Home Room by Room",
      subtitle: "A calm, step-by-step plan for a tidier home",
      format: "checklist",
      categories: ["home"],
      tags: ["decluttering", "organising", "minimalism", "checklist"],
      access: "free",
      drop: 2,
      licence: "plr",
      licenceTerms: PLR_LICENCE_TERMS,
      palette: ["#0e7490", "#082f49", "#a5f3fc"],
      motif: "grid",
      description:
        "Decluttering feels overwhelming when you try to do it all at once. This room-by-room guide breaks it into small, satisfying sessions, with a printable checklist for each area of the home.\n\n**Perfect for:** home organisation blogs, lead magnets, printable bundles.",
      highlights: ["Room-by-room checklist (PDF)", "Short companion guide", "Free-tier lead magnet"],
      files: ["ebook-docx", "checklist-pdf"],
      chapters: [
        {
          title: "Start Small",
          paras: ["Begin with one drawer or shelf, not a whole room. Quick wins build momentum."],
          points: ["One small area at a time", "Fifteen-minute sessions", "Keep, donate, recycle, bin"],
          steps: ["Set a 15-minute timer.", "Empty one drawer.", "Sort into four piles."],
        },
        {
          title: "Kitchen and Living Areas",
          paras: ["Shared spaces collect the most clutter. Clear surfaces first, then cupboards, then storage."],
          points: ["Clear benches and tables", "Remove duplicates", "Give everything a home"],
          steps: ["Clear the kitchen bench.", "Remove duplicate utensils.", "Add a drop zone by the door."],
        },
        {
          title: "Bedrooms and Wardrobes",
          paras: ["Keep clothes you wear and love. If you haven't worn it in a year, it's probably time to let it go."],
          points: ["Wear it or let it go", "One in, one out", "Store out-of-season items"],
          steps: ["Turn all hangers backwards; flip them as you wear items.", "Fill one donation bag.", "Clear under the bed."],
        },
      ],
    },
    {
      key: "side-hustle",
      title: "Start a Side Hustle This Weekend",
      subtitle: "A step-by-step mini-course from idea to first sale",
      format: "course",
      categories: ["business", "money"],
      tags: ["side hustle", "entrepreneurship", "extra income", "mini-course"],
      access: "premium",
      drop: 3,
      featured: true,
      licence: "plr",
      licenceTerms: PLR_LICENCE_TERMS,
      palette: ["#7e22ce", "#1e0838", "#f0abfc"],
      motif: "grid",
      description:
        "A five-lesson mini-course that takes readers from 'I'd like some extra income' to a tested idea and a first offer — in a single weekend.\n\nIncludes a workbook and a five-email launch sequence. It's scheduled for next month's drop so you can see how scheduled releases look to members.\n\n**Perfect for:** business coaches, career-change audiences, course creators.",
      highlights: ["Five lessons, ready to load into a course platform", "Workbook with exercises", "Five-email launch sequence", "Scheduled for next month's drop"],
      files: ["ebook-docx", "workbook-docx", "emails-txt"],
      chapters: [
        {
          title: "Lesson 1: Find Ideas You Can Start Now",
          paras: ["The best first side hustle uses skills, interests or experience you already have. List what friends ask you for help with, what you enjoy and what you've learned at work."],
          points: ["Start from existing skills", "Low cost to begin", "Something you'd enjoy doing weekly"],
          steps: ["List ten things people ask you for help with.", "Circle three you would enjoy.", "Note what each would cost to start."],
        },
        {
          title: "Lesson 2: Check There's Demand",
          paras: ["Before building anything, check that people already pay for it. Search marketplaces, groups and forums for similar offers and note their prices."],
          points: ["Existing competitors are a good sign", "Note prices and reviews", "Look for an underserved angle"],
          steps: ["Find five similar offers.", "Record prices and common complaints.", "Write your different angle."],
        },
        {
          title: "Lesson 3: Create a Simple Offer",
          paras: ["Your first offer should be small, clear and easy to deliver: one outcome, for one type of person, at one price."],
          points: ["One outcome", "One audience", "One price"],
          steps: ["Write your offer in one sentence.", "Set an introductory price.", "List what the buyer receives."],
        },
        {
          title: "Lesson 4: Get Your First Customer",
          paras: ["Tell people. Share your offer with friends, past colleagues and online groups where it's allowed. Your first customers often come from people who already know you."],
          points: ["Start with your network", "Be specific about who it's for", "Ask for referrals"],
          steps: ["Message ten people about your offer.", "Post once in a relevant group.", "Ask your first customer for feedback."],
        },
        {
          title: "Lesson 5: Grow Without Burning Out",
          paras: ["Protect your time. Set side-hustle hours, track income and expenses, and raise prices as demand grows."],
          points: ["Fixed weekly hours", "Track money from day one", "Raise prices with demand"],
          steps: ["Block side-hustle hours in your calendar.", "Start a simple income tracker.", "Review your price after ten sales."],
        },
      ],
    },
    {
      key: "parenting",
      title: "Mindful Parenting Basics",
      subtitle: "Calmer days and closer connection with your kids",
      format: "ebook",
      categories: ["family"],
      tags: ["parenting", "mindfulness", "family", "resell rights"],
      access: "member",
      drop: null,
      licence: "mrr",
      licenceTerms: MRR_LICENCE_TERMS,
      palette: ["#be185d", "#3f0a24", "#fecdd3"],
      motif: "waves",
      description:
        "A gentle introduction to mindful parenting: pausing before reacting, listening fully and building calm routines at home.\n\nThis product is supplied with **Master Resell Rights**, not PLR — it can be resold unchanged but not edited. It's included so you can see how licence rules appear on product pages.\n\n**Perfect for:** parenting blogs and family product bundles.",
      highlights: ["Master Resell Rights (not editable)", "Print-ready PDF", "Shows how licence limits are displayed"],
      files: ["ebook-pdf"],
      chapters: [
        {
          title: "Chapter 1: The Pause",
          paras: ["Mindful parenting starts with a pause — a breath between what happens and how you respond. That moment is where calmer choices live."],
          points: ["Pause before reacting", "Name your feeling", "Choose your response"],
          steps: ["Practise one deep breath before responding today.", "Notice your most common trigger.", "Plan a calm phrase to use."],
        },
        {
          title: "Chapter 2: Listening Fully",
          paras: ["Children feel connected when they feel heard. Get down to their level, put the phone away and reflect back what you hear."],
          points: ["Eye level, phone away", "Reflect feelings", "Listen before solving"],
          steps: ["Have one phone-free conversation each day.", "Reflect one feeling back.", "Ask an open question at dinner."],
        },
        {
          title: "Chapter 3: Calm Routines",
          paras: ["Predictable routines reduce conflict. Visual schedules, gentle transitions and connection time help the whole family feel settled."],
          points: ["Predictable days", "Warnings before transitions", "Daily connection time"],
          steps: ["Create a simple morning picture chart.", "Give five-minute warnings.", "Schedule ten minutes of one-on-one time."],
        },
      ],
    },
    {
      key: "wfh-focus",
      title: "Work From Home Focus Formula",
      subtitle: "Do your best work without leaving the house",
      format: "ebook",
      categories: ["business"],
      tags: ["remote work", "focus", "productivity"],
      access: "member",
      drop: null,
      status: "draft",
      licence: "plr",
      licenceTerms: PLR_LICENCE_TERMS,
      palette: ["#4338ca", "#111033", "#c7d2fe"],
      motif: "steps",
      description:
        "A draft product waiting for review — only the owner can see it. Publish it from Membership Admin to make it visible to members.\n\nA practical guide to focus, boundaries and energy for people working from home.",
      highlights: ["Draft — not visible to members", "Shows the publishing workflow"],
      files: ["ebook-docx"],
      chapters: [
        {
          title: "Chapter 1: A Space That Signals Work",
          paras: ["A dedicated spot — even a corner of a room — helps your brain switch into work mode."],
          points: ["One spot for work", "Good light", "Clear surface"],
          steps: ["Choose your work spot.", "Remove three distractions.", "Set up your lighting."],
        },
        {
          title: "Chapter 2: Protect Your Focus",
          paras: ["Work in focused blocks with notifications off, and batch messages into set times."],
          points: ["Focus blocks", "Notifications off", "Batch messages"],
          steps: ["Schedule two 50-minute focus blocks.", "Turn off non-essential notifications.", "Check email three times a day."],
        },
      ],
    },
  ],
  courses: [
    {
      key: "plr-profit-fundamentals",
      kind: "course",
      title: "PLR Profit Fundamentals",
      summary: "The complete path from choosing a PLR product to launching it as your own — rights, rebranding, packaging and your first sales.",
      level: "beginner",
      toolHint: null,
      access: "member",
      palette: ["#5b4df5", "#1b1660", "#f5b544"],
      motif: "rays",
      modules: [
        {
          title: "Module 1: Choosing PLR That Sells",
          lessons: [
            {
              title: "What PLR is (and isn't)",
              type: "article",
              durationMin: 6,
              body: "**Private Label Rights (PLR)** content is written so you can edit it, put your name on it and sell or give it away — within the limits of its licence.\n\nPLR is a *starting point*, not a finished product. The members who profit most treat it like a first draft: they rewrite the introduction, add their own stories and package it for a specific audience.\n\n### Key ideas\n- PLR saves you the blank page, not the thinking\n- The licence decides what you may do — always read it\n- Your angle and packaging are what make it valuable",
            },
            {
              title: "Reading a PLR licence",
              type: "article",
              durationMin: 8,
              body: "Every product in the library has a **licence summary** on its page. Check these rights before you plan anything:\n\n1. **Edit and rebrand** — can you change the content and put your name on it?\n2. **Sell** — can you sell the finished product, and is there a minimum price?\n3. **Give away** — can it be a free lead magnet?\n4. **Membership use** — can it go inside a paid membership?\n\nWhen a licence says nothing about a right, treat it as **not granted**. The Rights Review tool in the studio helps you record what each licence allows.",
            },
            {
              title: "Licence check — practice",
              type: "checklist",
              durationMin: 5,
              body: "Open any product in the library and confirm:\n\n- I found the licence summary on the product page\n- I know whether I can edit and claim authorship\n- I know whether I can sell it and at what minimum price\n- I know whether I can give it away\n- I downloaded the full licence file for my records",
            },
          ],
        },
        {
          title: "Module 2: Make It Yours",
          lessons: [
            {
              title: "The 30% rewrite rule of thumb",
              type: "article",
              durationMin: 7,
              body: "Search engines, customers and some licences reward content that has been genuinely improved. A useful target is to change **at least 30%**:\n\n- Rewrite the title, introduction and conclusion completely\n- Add a personal story or case study to each chapter\n- Update examples, numbers and references\n- Cut anything generic or padded\n\nUse **Edit in PLR Editor** on any product page to start a project, then the AI rewrite and Rebrand Studio to speed this up.",
            },
            {
              title: "Rebrand checklist",
              type: "checklist",
              durationMin: 5,
              body: "- New title and subtitle\n- Your name as author (if the licence allows)\n- Your brand colours and fonts\n- New cover from the Cover Creator\n- Old links, names and brands removed\n- Your call to action at the end of every chapter",
              attachment: { name: "rebrand-checklist.txt", content: "REBRAND CHECKLIST\n\n[ ] New title and subtitle\n[ ] Your name as author (if the licence allows)\n[ ] Your brand colours and fonts\n[ ] New cover\n[ ] Old links, names and brands removed\n[ ] Your call to action at the end of every chapter\n" },
            },
          ],
        },
        {
          title: "Module 3: Package and Launch",
          lessons: [
            {
              title: "Turn one PLR product into five",
              type: "article",
              durationMin: 9,
              body: "One ebook can become a whole product line:\n\n1. **The ebook** — your core product\n2. **A workbook** — the action steps as exercises\n3. **A checklist** — a free lead magnet\n4. **An email course** — five to seven emails from the chapters\n5. **A mini-course** — one lesson per chapter\n\nThe **Product Builder** creates each of these from your chapters, and the **Profit Map** shows how they fit into a funnel.",
            },
            {
              title: "Your first launch plan",
              type: "download",
              durationMin: 10,
              body: "Download the launch plan template and fill it in for your first product. Then open the **Launch Planner** in the studio to turn it into a dated checklist.",
              attachment: {
                name: "first-launch-plan.txt",
                content: "FIRST LAUNCH PLAN\n\nProduct:\nAudience:\nPrice:\nLead magnet:\n\nWEEK 1 — Prepare\n- Finish rewrite and cover\n- Write the sales page\n- Set up checkout\n\nWEEK 2 — Warm up\n- Share three helpful posts\n- Publish the lead magnet\n\nWEEK 3 — Launch\n- Send launch emails (days 1, 3, 5)\n- Share the offer on every channel\n\nWEEK 4 — Review\n- What sold? What didn't?\n- Plan the next product\n",
              },
            },
          ],
        },
      ],
    },
    {
      key: "rebrand-in-60",
      kind: "course",
      title: "Rebrand an Ebook in 60 Minutes",
      summary: "A focused, hands-on workshop: take one library ebook and turn it into a branded product you could sell today.",
      level: "intermediate",
      toolHint: "rebrand",
      access: "premium",
      palette: ["#0f766e", "#042f2e", "#fcd34d"],
      motif: "steps",
      modules: [
        {
          title: "The 60-minute workflow",
          lessons: [
            { title: "Minutes 0–10: Pick and import", type: "article", durationMin: 10, body: "Choose a library product whose licence allows editing. On its page, click **Edit in PLR Editor** next to the DOCX file. The editor splits it into chapters automatically." },
            { title: "Minutes 10–30: Rewrite the key parts", type: "article", durationMin: 20, body: "Rewrite the title, introduction and conclusion. Use **AI rewrite → Improve clarity** on any chapter that feels flat, then add one personal example per chapter." },
            { title: "Minutes 30–45: Rebrand", type: "article", durationMin: 15, body: "Open the **Rebrand Studio**, enter your new name and brand, generate replacement rules and accept the ones you want. Save a rebranded copy." },
            { title: "Minutes 45–60: Package", type: "checklist", durationMin: 15, body: "- Create a cover in the Cover Creator\n- Export the ebook as PDF and DOCX\n- Build a checklist lead magnet in the Product Builder\n- Add the product to your Profit Map" },
          ],
        },
      ],
    },
    {
      key: "tut-editor",
      kind: "tutorial",
      title: "Import and split a PLR ebook",
      summary: "Bring a DOCX or PDF into the PLR Editor and get clean chapters in under a minute.",
      level: "beginner",
      toolHint: "editor",
      access: "free",
      palette: ["#5b4df5", "#20186b", "#c4b5fd"],
      motif: "grid",
      modules: [
        {
          title: "Tutorial",
          lessons: [
            { title: "Import from the library", type: "article", durationMin: 3, body: "Open any product, find an editable file (DOCX, PDF, TXT, Markdown or HTML) and click **Edit in PLR Editor**. A new project is created and the document opens split into chapters." },
            { title: "Import your own file", type: "article", durationMin: 3, body: "In the **PLR Editor**, click **Import PLR**, drop a file and review the chapter split. You can switch the split strategy before importing if headings were missed." },
            { title: "Tidy the chapters", type: "checklist", durationMin: 4, body: "- Rename any chapter with a vague title\n- Merge very short chapters\n- Delete leftover promotional pages\n- Run Find & Replace for the old author name" },
          ],
        },
      ],
    },
    {
      key: "tut-rebrand",
      kind: "tutorial",
      title: "Use the Rebrand Studio",
      summary: "Replace names, brands and links across a whole document in a few clicks.",
      level: "beginner",
      toolHint: "rebrand",
      access: "member",
      palette: ["#0e7490", "#082f49", "#67e8f9"],
      motif: "waves",
      modules: [
        {
          title: "Tutorial",
          lessons: [
            { title: "Set your new brand", type: "article", durationMin: 3, body: "Choose the source document, then enter your new product name, author and website. These become the replacement targets." },
            { title: "Review replacements", type: "article", durationMin: 4, body: "Click **Generate rules** to find old names, brands and links. Accept the ones you want — or **Accept all** — then save the rebranded copy. The original document is never changed." },
          ],
        },
      ],
    },
    {
      key: "tut-builder",
      kind: "tutorial",
      title: "Build a workbook with the Product Builder",
      summary: "Turn chapters into a workbook, checklist or course in minutes.",
      level: "beginner",
      toolHint: "builder",
      access: "member",
      palette: ["#b45309", "#3b1d06", "#fde68a"],
      motif: "steps",
      modules: [
        {
          title: "Tutorial",
          lessons: [
            { title: "Choose a product type", type: "article", durationMin: 3, body: "Open the **Product Builder**, pick the source document and choose *Workbook*. Select the chapters to include." },
            { title: "Generate and save", type: "article", durationMin: 4, body: "Generate the draft, review each section and save it as a new document in your project. Export it to PDF or DOCX when you're happy." },
          ],
        },
      ],
    },
    {
      key: "tut-profit-map",
      kind: "tutorial",
      title: "Map your funnel with the Profit Map",
      summary: "Lay out lead magnet, front end, upsells and emails on one visual canvas.",
      level: "intermediate",
      toolHint: "profit-map",
      access: "member",
      palette: ["#be123c", "#3f0816", "#fda4af"],
      motif: "circles",
      modules: [
        {
          title: "Tutorial",
          lessons: [
            { title: "Start from a template", type: "article", durationMin: 3, body: "Open the **Profit Map** and pick a funnel template. Each step is a card you can drag, rename and connect." },
            { title: "Add prices and conversion rates", type: "article", durationMin: 4, body: "Enter prices and expected conversion rates on each step. The map estimates revenue per visitor so you can compare funnel ideas." },
          ],
        },
      ],
    },
  ],
  resources: [
    {
      title: "Sales Page Template",
      description: "A proven long-form sales page structure with fill-in-the-blank prompts for every section.",
      type: "template",
      access: "member",
      file: {
        name: "sales-page-template.md",
        content:
          "# [Headline: the result your reader wants]\n\n## [Sub-headline: how they get it, and how fast]\n\n**Dear friend,**\n\n[Describe the problem in the reader's words.]\n\n[Agitate: what happens if nothing changes?]\n\n## Introducing [Product name]\n\n[One-paragraph description.]\n\n### Inside you'll discover\n- [Benefit 1]\n- [Benefit 2]\n- [Benefit 3]\n\n### Bonuses\n1. [Bonus 1]\n2. [Bonus 2]\n\n### Your guarantee\n[Guarantee wording.]\n\n## Get instant access for [price]\n[Call to action]\n",
      },
    },
    {
      title: "Product Launch Checklist",
      description: "Every task from final edit to launch-day emails, in order.",
      type: "checklist",
      access: "free",
      file: {
        name: "product-launch-checklist.txt",
        content: "PRODUCT LAUNCH CHECKLIST\n\n[ ] Licence checked\n[ ] Content rewritten and proofread\n[ ] Cover created\n[ ] PDF and DOCX exported\n[ ] Sales page written\n[ ] Checkout tested\n[ ] Delivery email tested\n[ ] Lead magnet published\n[ ] Launch emails scheduled\n[ ] Social posts scheduled\n[ ] Launch day: monitor and reply\n[ ] Post-launch review\n",
      },
    },
    {
      title: "Launch Email Swipes",
      description: "Five launch emails — announcement, story, objections, last chance and closed.",
      type: "swipe",
      access: "member",
      file: {
        name: "launch-email-swipes.txt",
        content:
          "EMAIL 1 — It's here\nSubject: [Product] is open\n\nHi [Name],\n\n[Product] is live. Here's what it helps you do: [result].\n[Link]\n\nEMAIL 2 — The story\nSubject: Why I made [Product]\n\n[Short personal story.]\n\nEMAIL 3 — Objections\nSubject: \"But I don't have time…\"\n\n[Answer the top three objections.]\n\nEMAIL 4 — Last chance\nSubject: Closing tonight\n\n[Reminder of benefits and deadline.]\n\nEMAIL 5 — Closed\nSubject: Thank you\n\n[Thank buyers, tell non-buyers what's next.]\n",
      },
    },
    {
      title: "Headline Formulas",
      description: "25 headline formulas for sales pages, emails and social posts.",
      type: "swipe",
      access: "premium",
      file: {
        name: "headline-formulas.txt",
        content: "HEADLINE FORMULAS\n\n1. How to [result] without [pain]\n2. The [number]-minute [task] that [benefit]\n3. [Number] ways to [result] this week\n4. Why [common belief] is wrong — and what to do instead\n5. The simple [thing] that [surprising result]\n6. What [experts] know about [topic] that you don't\n7. Stop [mistake]. Start [better action].\n8. [Result] in [time] — even if [objection]\n9. The beginner's guide to [topic]\n10. Everything you need to [result], in one place\n",
      },
    },
    {
      title: "Profit Calculator",
      description: "Work out price, conversion and traffic targets for any product in the studio's Profit Calculator.",
      type: "tool",
      access: "member",
      url: "/profit",
    },
    {
      title: "Plain-English PLR Licence Guide",
      description: "What PLR, MRR and RR licences usually allow — and the questions to ask before you sell.",
      type: "guide",
      access: "free",
      file: {
        name: "plr-licence-guide.txt",
        content:
          "PLAIN-ENGLISH PLR LICENCE GUIDE\n\nPLR (Private Label Rights)\nUsually: edit, rebrand, put your name on it, sell or give away the finished product. Usually not: sell the PLR rights themselves.\n\nMRR (Master Resell Rights)\nUsually: sell unchanged and pass resell rights on. Usually not: edit or claim authorship.\n\nRR (Resell Rights)\nUsually: sell unchanged to end users only.\n\nAlways check:\n- Minimum price\n- Free giveaway rules\n- Membership use\n- Platforms that are not allowed (e.g. some marketplaces)\n\nIf a licence doesn't mention a right, assume it is NOT granted.\n",
      },
    },
  ],
};

export function sampleLibraryFor(brandId: string): SampleLibrary | null {
  return brandId === "plr-champion" ? CHAMPION_SAMPLE : null;
}
