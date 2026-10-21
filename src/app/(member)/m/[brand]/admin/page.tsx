"use client";

import { AdminHome } from "@/features/membership/admin/admin-home";
import { useMember } from "@/features/membership/member-context";
import { LabAdminHome } from "@/features/lab/admin/lab-admin";

export default function MembershipAdminPage() {
  const m = useMember();
  return m.brand.features.lab ? <LabAdminHome /> : <AdminHome />;
}
