"use client";

import { ProjectGate } from "@/components/common/project-gate";
import { BuilderStudio } from "@/features/product/builder-studio";

export default function LeadMagnetsPage() {
  return (
    <ProjectGate tool="Lead Magnet Creator">
      {(project) => <BuilderStudio kind="lead-magnet" project={project} description="Build free lead magnets from your existing products — short PDF reports, checklists, resource guides, mini email courses, worksheets and quick-start plans — then design a cover and export." />}
    </ProjectGate>
  );
}
