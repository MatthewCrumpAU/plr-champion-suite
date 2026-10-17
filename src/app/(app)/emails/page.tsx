"use client";

import { ProjectGate } from "@/components/common/project-gate";
import { EmailSwipeBuilder } from "@/features/marketing/email-swipe-builder";

export default function EmailsPage() {
  return <ProjectGate tool="Email Swipe Builder">{(project) => <EmailSwipeBuilder project={project} />}</ProjectGate>;
}
