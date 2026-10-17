"use client";

import { ProjectGate } from "@/components/common/project-gate";
import { RightsReview } from "@/features/research/rights-review";

export default function RightsPage() {
  return <ProjectGate tool="PLR Rights Review">{(project) => <RightsReview project={project} />}</ProjectGate>;
}
