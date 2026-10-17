"use client";

import { ProjectGate } from "@/components/common/project-gate";
import { FunnelPlanner } from "@/features/profit/funnel-planner";

export default function FunnelsPage() {
  return <ProjectGate tool="Funnel Planner">{(project) => <FunnelPlanner project={project} />}</ProjectGate>;
}
