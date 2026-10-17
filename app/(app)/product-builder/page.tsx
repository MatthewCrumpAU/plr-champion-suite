"use client";

import { ProjectGate } from "@/components/common/project-gate";
import { BuilderStudio } from "@/features/product/builder-studio";

export default function ProductBuilderPage() {
  return (
    <ProjectGate tool="Product Builder">
      {(project) => <BuilderStudio kind="product" project={project} description="Turn your PLR into new products — ebooks, guides, workbooks, checklists, courses, email courses, challenges, membership modules and toolkits — built from the chapters you choose." />}
    </ProjectGate>
  );
}
