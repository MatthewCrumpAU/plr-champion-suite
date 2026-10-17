import { redirect } from "next/navigation";
import { memberPath } from "@/lib/membership/brands";

export default function MembershipIndex() {
  redirect(memberPath("plr-champion"));
}
