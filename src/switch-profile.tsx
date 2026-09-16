import {
  Action,
  ActionPanel,
  closeMainWindow,
  Color,
  Icon,
  Image,
  Keyboard,
  launchCommand,
  LaunchType,
  List,
  open,
  openExtensionPreferences,
  showHUD,
  showToast,
  Toast,
} from "@raycast/api";
import { useCallback, useEffect, useState } from "react";
import { AliasMap, getAliases } from "./aliases";
import {
  CometProfile,
  getProfiles,
  getUserDataDir,
  isCometInstalled,
  launchProfile,
  profileDeeplink,
  quicklinkName,
} from "./comet";
import { join } from "node:path";

function profileIcon(profile: CometProfile): Image.ImageLike {
  if (profile.avatarPath) return { source: profile.avatarPath, mask: Image.Mask.Circle };
  return { source: Icon.PersonCircle, tintColor: profile.color ?? Color.PrimaryText };
}

async function openProfile(profile: CometProfile, newWindow = false) {
  await closeMainWindow({ clearRootSearch: true });
  try {
    await launchProfile(profile, { newWindow });
    await showHUD(`Opening Comet · ${profile.name}`);
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Couldn't open Comet",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export default function Command() {
  // getProfiles() is synchronous and cached, so the list renders fully on first paint.
  const [profiles, setProfiles] = useState<CometProfile[]>(getProfiles);
  const refresh = useCallback(() => setProfiles(getProfiles()), []);
  const [aliases, setAliases] = useState<AliasMap>({});
  useEffect(() => {
    getAliases().then(setAliases);
  }, []);
  const installed = isCometInstalled();

  if (!installed) {
    return (
      <List>
        <List.EmptyView
          icon={Icon.Warning}
          title="Comet is not installed"
          description="Install Comet, or point the extension at your Comet app in preferences."
          actions={
            <ActionPanel>
              <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
            </ActionPanel>
          }
        />
      </List>
    );
  }

  return (
    <List searchBarPlaceholder="Search Comet profiles…">
      <List.EmptyView
        icon={Icon.Person}
        title="No profiles found"
        description={`Nothing readable in ${getUserDataDir()}. Open Comet once, or check the data directory in preferences.`}
        actions={
          <ActionPanel>
            <Action title="Refresh" icon={Icon.ArrowClockwise} onAction={refresh} />
            <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
          </ActionPanel>
        }
      />
      {profiles.map((profile) => {
        const accessories: List.Item.Accessory[] = [];
        const profileAliases = aliases[profile.directory] ?? [];
        for (const alias of profileAliases) accessories.push({ tag: alias, tooltip: `Alias: ${alias}` });
        if (profile.active)
          accessories.push({ icon: { source: Icon.Dot, tintColor: Color.Green }, tooltip: "Window open" });
        if (profile.lastUsed) accessories.push({ tag: "Last used" });
        return (
          <List.Item
            key={profile.directory}
            id={profile.directory}
            icon={profileIcon(profile)}
            title={profile.name}
            subtitle={profile.directory}
            keywords={[profile.directory, ...profileAliases]}
            accessories={accessories}
            actions={
              <ActionPanel>
                <ActionPanel.Section>
                  <Action title="Open Profile" icon={Icon.Globe} onAction={() => openProfile(profile)} />
                  <Action
                    title="Open in New Window"
                    icon={Icon.NewDocument}
                    shortcut={{ modifiers: ["cmd"], key: "return" }}
                    onAction={() => openProfile(profile, true)}
                  />
                </ActionPanel.Section>
                <ActionPanel.Section title="Alias & Hotkey">
                  <Action.CreateQuicklink
                    title="Create Quicklink for Profile"
                    icon={Icon.Link}
                    shortcut={{ modifiers: ["cmd"], key: "l" }}
                    quicklink={{ name: quicklinkName(profile), link: profileDeeplink(profile) }}
                  />
                  <Action.CopyToClipboard
                    title="Copy Deeplink"
                    content={profileDeeplink(profile)}
                    shortcut={Keyboard.Shortcut.Common.Copy}
                  />
                  <Action
                    title="Manage Shortcuts"
                    icon={Icon.Keyboard}
                    shortcut={Keyboard.Shortcut.Common.Duplicate}
                    onAction={() => launchCommand({ name: "shortcuts", type: LaunchType.UserInitiated })}
                  />
                </ActionPanel.Section>
                <ActionPanel.Section>
                  <Action
                    title="Reveal Profile Folder in Finder"
                    icon={Icon.Finder}
                    shortcut={{ modifiers: ["cmd", "shift"], key: "f" }}
                    onAction={() => open(join(getUserDataDir(), profile.directory), "com.apple.finder")}
                  />
                  <Action
                    title="Refresh Profiles"
                    icon={Icon.ArrowClockwise}
                    shortcut={Keyboard.Shortcut.Common.Refresh}
                    onAction={refresh}
                  />
                  <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
                </ActionPanel.Section>
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}
