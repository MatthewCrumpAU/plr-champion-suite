"use client";

import { ProjectGate } from "@/components/common/project-gate";
import { RebrandAssistant } from "@/features/content/rebrand-assistant";

export default function MemberRebrandPage() {
  return <ProjectGate tool="Rebrand Studio">{(project) => <RebrandAssistant project={project} />}</ProjectGate>;
}
