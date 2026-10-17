"use client";

import { ProjectGate } from "@/components/common/project-gate";
import { BuilderStudio } from "@/features/product/builder-studio";

export default function BonusBuilderPage() {
  return (
    <ProjectGate tool="Bonus Builder">
      {(project) => <BuilderStudio kind="bonus" project={project} description="Create complementary bonuses — action plans, worksheets, resource lists, quick-start guides, checklists, templates, cheat sheets and implementation plans. Each bonus is saved as its own document you can edit and export." />}
    </ProjectGate>
  );
}
