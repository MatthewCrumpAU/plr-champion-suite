"use client";

import { ProjectGate } from "@/components/common/project-gate";
import { ProfitCalculator } from "@/features/profit/profit-calculator";

export default function ProfitPage() {
  return <ProjectGate tool="Profit Calculator">{(project) => <ProfitCalculator project={project} />}</ProjectGate>;
}
