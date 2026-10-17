"use client";

import { ProjectGate } from "@/components/common/project-gate";
import { NicheResearch } from "@/features/research/niche-research";

export default function NicheResearchPage() {
  return <ProjectGate tool="Niche Research">{(project) => <NicheResearch project={project} />}</ProjectGate>;
}
