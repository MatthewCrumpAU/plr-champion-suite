"use client";

import { ProjectGate } from "@/components/common/project-gate";
import { CoverCreator } from "@/features/design/cover-creator";

export default function CoversPage() {
  return <ProjectGate tool="Cover Creator">{(project) => <CoverCreator project={project} />}</ProjectGate>;
}
