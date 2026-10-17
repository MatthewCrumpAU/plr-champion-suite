import { getRepos, type Repositories } from "@/lib/data";

export interface AppSettings {
  /** null = use the server's configured default model. */
  aiModel: string | null;
  autosaveDelayMs: number;
  autoVersionMinutes: number;
  confirmAIReplace: boolean;
  editorWidth: "narrow" | "normal" | "wide";
  currency: string;
  /** Show a reminder about licence review before export. */
  licenceReminder: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  aiModel: null,
  autosaveDelayMs: 800,
  autoVersionMinutes: 10,
  confirmAIReplace: true,
  editorWidth: "normal",
  currency: "USD",
  licenceReminder: true,
};

const KEY = "app";

export async function loadSettings(repos: Repositories = getRepos()): Promise<AppSettings> {
  const stored = await repos.settings.get<Partial<AppSettings>>(KEY);
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
}

export async function saveSettings(patch: Partial<AppSettings>, repos: Repositories = getRepos()): Promise<AppSettings> {
  const next = { ...(await loadSettings(repos)), ...patch };
  await repos.settings.set(KEY, next);
  return next;
}
