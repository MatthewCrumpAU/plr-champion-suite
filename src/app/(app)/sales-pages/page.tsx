"use client";

import { ProjectGate } from "@/components/common/project-gate";
import { SalesPageBuilder } from "@/features/marketing/sales-page-builder";

export default function SalesPagesPage() {
  return <ProjectGate tool="Sales Page Builder">{(project) => <SalesPageBuilder project={project} />}</ProjectGate>;
}
