"use client";

import { ProjectGate } from "@/components/common/project-gate";
import { KeywordFinder } from "@/features/research/keyword-finder";

export default function KeywordsPage() {
  return <ProjectGate tool="Keyword Finder">{(project) => <KeywordFinder project={project} />}</ProjectGate>;
}
