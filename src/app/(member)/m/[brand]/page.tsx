"use client";

import { MemberDashboard } from "@/features/membership/dashboard";
import { useMember } from "@/features/membership/member-context";
import { LabDashboard } from "@/features/lab/dashboard";

export default function MemberDashboardPage() {
  const m = useMember();
  return m.brand.features.lab ? <LabDashboard /> : <MemberDashboard />;
}
