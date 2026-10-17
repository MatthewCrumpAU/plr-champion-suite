"use client";

import { ProjectGate } from "@/components/common/project-gate";
import { OutlineGenerator } from "@/features/content/outline-generator";

export default function OutlinesPage() {
  return <ProjectGate tool="Outline Generator">{(project) => <OutlineGenerator project={project} />}</ProjectGate>;
}
