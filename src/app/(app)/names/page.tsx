"use client";

import { ProjectGate } from "@/components/common/project-gate";
import { NameGenerator } from "@/features/marketing/name-generator";

export default function NamesPage() {
  return <ProjectGate tool="Product Name Generator">{(project) => <NameGenerator project={project} />}</ProjectGate>;
}
