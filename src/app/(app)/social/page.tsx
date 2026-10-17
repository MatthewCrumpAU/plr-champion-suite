"use client";

import { ProjectGate } from "@/components/common/project-gate";
import { SocialContentCreator } from "@/features/marketing/social-content-creator";

export default function SocialPage() {
  return <ProjectGate tool="Social Content Creator">{(project) => <SocialContentCreator project={project} />}</ProjectGate>;
}
