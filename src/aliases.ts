import { LocalStorage } from "@raycast/api";

/** Map of profile directory → user-defined aliases (lower-cased, unique). */
export type AliasMap = Record<string, string[]>;

const KEY = "profile-aliases-v1";

export function parseAliasInput(input: string): string[] {
  const seen = new Set<string>();
  for (const raw of input.split(/[,\n]/)) {
    const alias = raw.trim().toLowerCase().replace(/\s+/g, " ");
    if (alias) seen.add(alias);
  }
  return [...seen];
}

export async function getAliases(): Promise<AliasMap> {
  const raw = await LocalStorage.getItem<string>(KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as AliasMap) : {};
  } catch {
    return {};
  }
}

export async function setAliasesFor(directory: string, aliases: string[]): Promise<AliasMap> {
  const all = await getAliases();
  // An alias can only point at one profile: drop it from any other profile first.
  for (const dir of Object.keys(all)) {
    if (dir !== directory) all[dir] = all[dir].filter((a) => !aliases.includes(a));
    if (!all[dir]?.length) delete all[dir];
  }
  if (aliases.length) all[directory] = aliases;
  else delete all[directory];
  await LocalStorage.setItem(KEY, JSON.stringify(all));
  return all;
}
