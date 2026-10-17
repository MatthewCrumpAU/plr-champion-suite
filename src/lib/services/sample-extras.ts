import type { Repositories } from "@/lib/data";
import type { BrandKit } from "@/lib/data/types";
import { COVER_TEMPLATES, buildFromTemplate } from "@/lib/covers/templates";
import { defaultMockupData } from "@/lib/models/design";
import { defaultLaunchPlanData, newScenario } from "@/lib/models/defaults";
import { FUNNEL_TEMPLATES } from "@/lib/profit/funnel";
import { BUILT_IN_TEMPLATES, addDays, applyTemplate, todayIso } from "@/lib/profit/launch";
import { createAsset } from "./assets";
import { updateProject } from "./projects";
import { uid } from "@/lib/utils";

/**
 * Additional sample assets (cover, mockup, funnel, profit model, launch plan…).
 * Kept separate so each studio can contribute sample content as it is built.
 */
export async function sampleExtras(projectId: string, _documentId: string, kit: BrandKit, repos: Repositories): Promise<void> {
  const tpl = COVER_TEMPLATES.find((t) => t.id === "bold-gradient") ?? COVER_TEMPLATES[0];
  const cover = await createAsset(
    projectId,
    "cover",
    {
      title: "The Calm Productivity Blueprint — cover",
      status: "in-progress",
      data: buildFromTemplate(
        tpl,
        { title: "The Calm Productivity Blueprint", subtitle: "A simple plan for remote workers to do focused work and finish by five", author: kit.authorName, tagline: kit.tagline, brand: kit.brandName },
        { palette: kit.colors, heading: kit.headingFont, body: kit.bodyFont },
      ),
    },
    repos,
  );
  await createAsset(
    projectId,
    "mockup",
    {
      title: "The Calm Productivity Blueprint — 3D ebook",
      data: defaultMockupData({ kind: "ebook-3d", sources: [{ id: uid("src"), kind: "cover", refId: cover.id }] }),
      sourceAssetIds: [cover.id],
    },
    repos,
  );
  await updateProject(projectId, { coverAssetId: cover.id }, repos);

  // Profit model: two clearly hypothetical scenarios.
  const base = newScenario({ name: "Base case", price: 17, traffic: 1500, conversionRate: 2, adSpend: 150, fixedCosts: 49, refundRate: 3 });
  const higher = newScenario({ name: "Higher price", price: 27, traffic: 1500, conversionRate: 1.5, adSpend: 150, fixedCosts: 49, refundRate: 3 });
  await createAsset(projectId, "profit-scenario", { title: "SAMPLE profit model (hypothetical)", data: { currency: "USD", scenarios: [base, higher], activeScenarioId: base.id, actuals: [] } }, repos);

  // Funnel from the lead magnet template.
  const funnelTpl = FUNNEL_TEMPLATES.find((t) => t.id === "lead") ?? FUNNEL_TEMPLATES[0];
  await createAsset(projectId, "funnel", { title: "SAMPLE lead magnet funnel", data: { ...funnelTpl.build({ product: "The Calm Productivity Blueprint" }), assumptions: { traffic: 1000, currency: "USD", adSpend: 0 }, notes: "Sample funnel. Take rates are placeholders — replace them with your own assumptions." } }, repos);

  // Launch plan three weeks out.
  const plan = applyTemplate({ ...defaultLaunchPlanData(), launchDate: addDays(todayIso(), 21) }, BUILT_IN_TEMPLATES[0], "replace");
  await createAsset(projectId, "launch-plan", { title: "SAMPLE launch plan", data: plan }, repos);
}
