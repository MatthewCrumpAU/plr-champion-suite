"use client";

import { ProjectGate } from "@/components/common/project-gate";
import { FunnelPlanner } from "@/features/profit/funnel-planner";

export default function MemberProfitMapPage() {
  return <ProjectGate tool="Profit Map">{(project) => <FunnelPlanner project={project} />}</ProjectGate>;
}
