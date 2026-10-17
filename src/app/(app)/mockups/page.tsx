"use client";

import { ProjectGate } from "@/components/common/project-gate";
import { MockupStudio } from "@/features/design/mockup-studio";

export default function MockupsPage() {
  return <ProjectGate tool="Mockup Studio">{(project) => <MockupStudio project={project} />}</ProjectGate>;
}
