"use client";

import { ProjectGate } from "@/components/common/project-gate";
import { RebrandAssistant } from "@/features/content/rebrand-assistant";

export default function RebrandPage() {
  return <ProjectGate tool="Rebrand Assistant">{(project) => <RebrandAssistant project={project} />}</ProjectGate>;
}
