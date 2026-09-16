import { closeMainWindow, launchCommand, LaunchProps, LaunchType, showHUD, showToast, Toast } from "@raycast/api";
import { getAliases } from "./aliases";
import { findProfile, getProfiles, isCometInstalled, launchProfile } from "./comet";

interface Arguments {
  profile?: string;
  url?: string;
}

export default async function Command(props: LaunchProps<{ arguments: Arguments }>) {
  const query = props.arguments.profile?.trim() ?? "";
  const url = props.arguments.url?.trim();

  if (!query) {
    // No profile given: fall back to the picker.
    await launchCommand({ name: "switch-profile", type: LaunchType.UserInitiated });
    return;
  }

  if (!isCometInstalled()) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Comet is not installed",
      message: "Set the Comet Application in the extension preferences.",
    });
    return;
  }

  const profiles = getProfiles();
  const profile = findProfile(query, profiles, await getAliases());
  if (!profile) {
    await showToast({
      style: Toast.Style.Failure,
      title: `No Comet profile matches “${query}”`,
      message: profiles.length ? `Available: ${profiles.map((p) => p.name).join(", ")}` : "No profiles found.",
    });
    return;
  }

  await closeMainWindow({ clearRootSearch: true });
  try {
    await launchProfile(profile, { url });
    await showHUD(`Opening Comet · ${profile.name}`);
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Couldn't open Comet",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
