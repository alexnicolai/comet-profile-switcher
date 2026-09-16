import { Cache, environment, getPreferenceValues, Application } from "@raycast/api";
import type { AliasMap } from "./aliases";
import { execFile } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface CometProfile {
  /** Directory name inside the user data dir, e.g. "Default" or "Profile 2". */
  directory: string;
  /** Display name chosen in Comet. */
  name: string;
  /** Hex color derived from the profile's theme, e.g. "#4b7c79". */
  color?: string;
  /** Absolute path to a custom avatar image, if the profile has one. */
  avatarPath?: string;
  /** Whether this was the most recently used profile. */
  lastUsed: boolean;
  /** Whether this profile currently has an open window (per Comet's own bookkeeping). */
  active: boolean;
}

interface Preferences {
  cometApp?: Application;
  userDataDir?: string;
  alwaysNewWindow?: boolean;
}

interface LocalStateProfileEntry {
  name?: string;
  profile_color_seed?: number;
  default_avatar_stroke_color?: number;
  profile_highlight_color?: number;
  use_gaia_picture?: boolean;
  is_using_default_avatar?: boolean;
}

interface LocalState {
  profile?: {
    info_cache?: Record<string, LocalStateProfileEntry>;
    profiles_order?: string[];
    last_used?: string;
    last_active_profiles?: string[];
  };
}

const DEFAULT_APP_PATH = "/Applications/Comet.app";
const DEFAULT_USER_DATA_DIR = join(homedir(), "Library", "Application Support", "Comet");
const CACHE_KEY = "profiles-v1";

const cache = new Cache({ capacity: 64 * 1024 });

function expandHome(p: string): string {
  return p.startsWith("~") ? join(homedir(), p.slice(1)) : p;
}

export function getUserDataDir(): string {
  const { userDataDir } = getPreferenceValues<Preferences>();
  const dir = userDataDir?.trim();
  return dir ? expandHome(dir) : DEFAULT_USER_DATA_DIR;
}

export function getAppPath(): string {
  const { cometApp } = getPreferenceValues<Preferences>();
  if (cometApp?.path && existsSync(cometApp.path)) return cometApp.path;
  return DEFAULT_APP_PATH;
}

export function isCometInstalled(): boolean {
  return existsSync(getAppPath());
}

/** Chromium stores colors as signed 32-bit ARGB integers. */
function argbToHex(n: number | undefined): string | undefined {
  if (typeof n !== "number" || !Number.isFinite(n)) return undefined;
  return "#" + ((n >>> 0) & 0xffffff).toString(16).padStart(6, "0");
}

function parseProfiles(localStatePath: string, userDataDir: string): CometProfile[] {
  const state = JSON.parse(readFileSync(localStatePath, "utf8")) as LocalState;
  const info = state.profile?.info_cache ?? {};
  const lastUsed = state.profile?.last_used;
  const active = new Set(state.profile?.last_active_profiles ?? []);
  const ordered = state.profile?.profiles_order?.filter((d) => d in info) ?? [];
  const rest = Object.keys(info).filter((d) => !ordered.includes(d));

  return [...ordered, ...rest].map((directory) => {
    const entry = info[directory] ?? {};
    const picture = join(userDataDir, directory, "Google Profile Picture.png");
    const hasPicture = (entry.use_gaia_picture || entry.is_using_default_avatar === false) && existsSync(picture);
    return {
      directory,
      name: entry.name?.trim() || directory,
      color:
        argbToHex(entry.default_avatar_stroke_color) ??
        argbToHex(entry.profile_color_seed) ??
        argbToHex(entry.profile_highlight_color),
      avatarPath: hasPicture ? picture : undefined,
      lastUsed: directory === lastUsed,
      active: active.has(directory),
    };
  });
}

/**
 * Reads Comet's profile registry ("Local State"). The file is ~1 MB, so the parsed
 * result is cached and only re-read when the file's mtime/size changes.
 */
export function getProfiles(): CometProfile[] {
  const userDataDir = getUserDataDir();
  const localStatePath = join(userDataDir, "Local State");
  let stamp: string;
  try {
    const st = statSync(localStatePath);
    stamp = `${localStatePath}|${st.mtimeMs}|${st.size}`;
  } catch {
    return [];
  }

  const cached = cache.get(CACHE_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as { stamp: string; profiles: CometProfile[] };
      if (parsed.stamp === stamp) return parsed.profiles;
    } catch {
      // fall through and re-read
    }
  }

  try {
    const profiles = parseProfiles(localStatePath, userDataDir);
    cache.set(CACHE_KEY, JSON.stringify({ stamp, profiles }));
    return profiles;
  } catch {
    return [];
  }
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Resolve user input to a profile. Matches, in order: user alias, exact name, exact directory,
 * name prefix, name/directory substring. Case-insensitive.
 */
export function findProfile(
  query: string,
  profiles: CometProfile[] = getProfiles(),
  aliases: AliasMap = {},
): CometProfile | undefined {
  const q = normalize(query);
  if (!q) return undefined;
  return (
    profiles.find((p) => aliases[p.directory]?.includes(q)) ??
    profiles.find((p) => normalize(p.name) === q) ??
    profiles.find((p) => normalize(p.directory) === q) ??
    profiles.find((p) => normalize(p.name).startsWith(q)) ??
    profiles.find((p) => normalize(p.name).includes(q) || normalize(p.directory).includes(q))
  );
}

export interface LaunchOptions {
  url?: string;
  newWindow?: boolean;
}

function normalizeUrl(raw: string | undefined): string | undefined {
  const u = raw?.trim();
  if (!u) return undefined;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return u; // already has a scheme (https:, chrome:, file:, …)
  return `https://${u}`;
}

/**
 * Launches Comet for the given profile. Uses `open -n` so macOS always spawns a fresh
 * launcher process; Chromium's singleton then hands the request to the running instance
 * (or becomes it) and focuses/opens a window for that profile. Nothing stays attached to Raycast.
 */
export function launchProfile(profile: CometProfile, options: LaunchOptions = {}): Promise<void> {
  const { alwaysNewWindow } = getPreferenceValues<Preferences>();
  const args = ["-na", getAppPath(), "--args", `--profile-directory=${profile.directory}`];
  if (options.newWindow || alwaysNewWindow) args.push("--new-window");
  const url = normalizeUrl(options.url);
  if (url) args.push(url);

  return new Promise((resolve, reject) => {
    execFile("/usr/bin/open", args, { timeout: 15_000 }, (error, _stdout, stderr) => {
      if (error) reject(new Error(stderr?.trim() || error.message));
      else resolve();
    });
  });
}

/** Deeplink to one of this extension's commands. */
export function commandDeeplink(command: string, args?: Record<string, string>): string {
  const base = `raycast://extensions/${environment.ownerOrAuthorName}/${environment.extensionName}/${command}`;
  return args ? `${base}?arguments=${encodeURIComponent(JSON.stringify(args))}` : base;
}

/** Deeplink that runs the "Open Comet Profile" command for this profile. Usable as a Quicklink. */
export function profileDeeplink(profile: CometProfile): string {
  return commandDeeplink("open-profile", { profile: profile.directory });
}

/** The name the "Create Quicklink" action proposes for a profile. */
export function quicklinkName(profile: CometProfile): string {
  return `Comet · ${profile.name}`;
}
