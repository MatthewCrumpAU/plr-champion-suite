"use client";

import { ProjectGate } from "@/components/common/project-gate";
import { LaunchPlanner } from "@/features/profit/launch-planner";

export default function LaunchPage() {
  return <ProjectGate tool="Launch Planner">{(project) => <LaunchPlanner project={project} />}</ProjectGate>;
}
