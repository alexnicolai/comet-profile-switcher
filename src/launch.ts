import { closeMainWindow, showHUD, showToast, Toast } from "@raycast/api";
import { CometProfile, getProfiles, isCometInstalled, launchProfile } from "./comet";

/** Shared body of every "open this profile" command. */
export async function runProfileCommand(directory: string, fallbackName: string, url?: string): Promise<void> {
  if (!isCometInstalled()) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Comet is not installed",
      message: "Set the Comet Application in the extension preferences.",
    });
    return;
  }
  const profile: CometProfile = getProfiles().find((p) => p.directory === directory) ?? {
    directory,
    name: fallbackName,
    lastUsed: false,
    active: false,
  };
  await openProfile(profile, { url });
}

export async function openProfile(profile: CometProfile, options: { url?: string; newWindow?: boolean } = {}) {
  await closeMainWindow({ clearRootSearch: true });
  try {
    await launchProfile(profile, options);
    await showHUD(`Opening Comet · ${profile.name}`);
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Couldn't open Comet",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
