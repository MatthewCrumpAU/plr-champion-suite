"use client";

import { ProjectGate } from "@/components/common/project-gate";
import { OpportunityScanner } from "@/features/product/opportunity-scanner";

export default function OpportunitiesPage() {
  return <ProjectGate tool="Opportunity Scanner">{(project) => <OpportunityScanner project={project} />}</ProjectGate>;
}
