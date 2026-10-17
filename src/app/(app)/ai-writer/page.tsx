"use client";

import { ProjectGate } from "@/components/common/project-gate";
import { AIWriter } from "@/features/content/ai-writer";

export default function AIWriterPage() {
  return <ProjectGate tool="AI Writer">{(project) => <AIWriter key={project.id} project={project} />}</ProjectGate>;
}
