import { nowIso, uid } from "@/lib/utils";
import { getMembershipRepos, type MembershipRepositories } from "@/lib/membership/db";
import type { BrandId } from "@/lib/membership/types";
import { defaultProfile, normalizeProfile, profileId } from "./profit-path";
import type { CustomPathTask, LabProgress, LabProgressKind, ProfitPathProfile } from "./types";

/**
 * Profit Path profiles and member progress. Progress is one row per member per plan, campaign or
 * Build Day (`done`, `notes` and Build Day extras), so it moves to Supabase as a single table.
 */

const repo = (r?: MembershipRepositories) => r ?? getMembershipRepos();

/* ---------------------------------------- Profiles ---------------------------------------- */

export async function getProfile(brandId: BrandId, memberId: string, repos?: MembershipRepositories): Promise<ProfitPathProfile | null> {
  const p = await repo(repos).labProfiles.get(profileId(memberId));
  return p && p.brandId === brandId ? normalizeProfile(p) : null;
}

export async function saveProfile(p: ProfitPathProfile, repos?: MembershipRepositories): Promise<ProfitPathProfile> {
  const next = normalizeProfile({ ...p, id: profileId(p.memberId), updatedAt: nowIso() });
  await repo(repos).labProfiles.put(next);
  return next;
}

export async function createProfile(brandId: BrandId, memberId: string, patch: Partial<ProfitPathProfile> = {}, repos?: MembershipRepositories): Promise<ProfitPathProfile> {
  return saveProfile(defaultProfile(brandId, memberId, new Date(), patch), repos);
}

export async function deleteProfile(memberId: string, repos?: MembershipRepositories) {
  const r = repo(repos);
  await r.labProfiles.delete(profileId(memberId));
  await r.labProgress.delete(progressId(memberId, "path", profileId(memberId)));
}

export async function addCustomTask(p: ProfitPathProfile, input: Omit<CustomPathTask, "id">, repos?: MembershipRepositories): Promise<ProfitPathProfile> {
  const title = input.title.trim();
  if (!title) throw new Error("Give the task a name.");
  const task: CustomPathTask = { id: uid("ct"), title, detail: input.detail.trim(), date: input.date, minutes: Math.max(5, Math.round(input.minutes || 30)) };
  return saveProfile({ ...p, customTasks: [...p.customTasks, task] }, repos);
}

export async function removeCustomTask(p: ProfitPathProfile, id: string, repos?: MembershipRepositories): Promise<ProfitPathProfile> {
  return saveProfile({ ...p, customTasks: p.customTasks.filter((t) => t.id !== id) }, repos);
}

export async function setTaskSkipped(p: ProfitPathProfile, key: string, skipped: boolean, repos?: MembershipRepositories): Promise<ProfitPathProfile> {
  const set = new Set(p.skippedTaskKeys);
  if (skipped) set.add(key);
  else set.delete(key);
  return saveProfile({ ...p, skippedTaskKeys: [...set] }, repos);
}

/* ---------------------------------------- Progress ---------------------------------------- */

export const progressId = (memberId: string, kind: LabProgressKind, refId: string) => `${memberId}:${kind}:${refId}`;

export function emptyProgress(brandId: BrandId, memberId: string, kind: LabProgressKind, refId: string): LabProgress {
  return { id: progressId(memberId, kind, refId), brandId, memberId, kind, refId, done: {}, notes: {}, rsvp: null, attended: false, ownActions: [], journal: "", updatedAt: nowIso() };
}

export async function getProgress(brandId: BrandId, memberId: string, kind: LabProgressKind, refId: string, repos?: MembershipRepositories): Promise<LabProgress> {
  const row = await repo(repos).labProgress.get(progressId(memberId, kind, refId));
  return row ? { ...emptyProgress(brandId, memberId, kind, refId), ...row } : emptyProgress(brandId, memberId, kind, refId);
}

/** Read-modify-write inside a transaction so quick double clicks can't lose a tick. */
export async function updateProgress(brandId: BrandId, memberId: string, kind: LabProgressKind, refId: string, fn: (p: LabProgress) => LabProgress, repos?: MembershipRepositories): Promise<LabProgress> {
  const r = repo(repos);
  return r.transaction(async () => {
    const cur = await getProgress(brandId, memberId, kind, refId, r);
    const next = { ...fn(cur), id: cur.id, brandId, memberId, kind, refId, updatedAt: nowIso() };
    await r.labProgress.put(next);
    return next;
  });
}

export function setDone(brandId: BrandId, memberId: string, kind: LabProgressKind, refId: string, key: string, done: boolean, repos?: MembershipRepositories) {
  return updateProgress(
    brandId,
    memberId,
    kind,
    refId,
    (p) => {
      const next = { ...p.done };
      if (done) next[key] = next[key] ?? nowIso();
      else delete next[key];
      return { ...p, done: next };
    },
    repos,
  );
}

export function setNote(brandId: BrandId, memberId: string, kind: LabProgressKind, refId: string, key: string, note: string, repos?: MembershipRepositories) {
  return updateProgress(
    brandId,
    memberId,
    kind,
    refId,
    (p) => {
      const notes = { ...p.notes };
      if (note.trim()) notes[key] = note;
      else delete notes[key];
      return { ...p, notes };
    },
    repos,
  );
}

export async function resetProgress(memberId: string, kind: LabProgressKind, refId: string, repos?: MembershipRepositories) {
  await repo(repos).labProgress.delete(progressId(memberId, kind, refId));
}
