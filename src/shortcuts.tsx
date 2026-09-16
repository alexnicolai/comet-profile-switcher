import {
  Action,
  ActionPanel,
  Color,
  Form,
  Icon,
  Image,
  Keyboard,
  List,
  openExtensionPreferences,
  popToRoot,
  showHUD,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useCallback, useEffect, useState } from "react";
import { AliasMap, getAliases, parseAliasInput, setAliasesFor } from "./aliases";
import { CometProfile, commandDeeplink, getProfiles, launchProfile, profileDeeplink, quicklinkName } from "./comet";

function profileIcon(profile: CometProfile): Image.ImageLike {
  if (profile.avatarPath) return { source: profile.avatarPath, mask: Image.Mask.Circle };
  return { source: Icon.PersonCircle, tintColor: profile.color ?? Color.PrimaryText };
}

function profileMarkdown(profile: CometProfile, aliases: string[]): string {
  const aliasLine = aliases.length ? aliases.map((a) => `\`${a}\``).join("  ") : "_None yet — press ⌘E to add some._";
  const example = aliases[0] ?? profile.name.toLowerCase();
  return `# ${profile.name}

## Aliases
${aliasLine}

Aliases are understood by the **Open Comet Profile** command. Type \`Open Comet Profile ${example}\` in Raycast, or give that command a short alias such as \`comet\` in Raycast Settings and type \`comet ${example}\`.

## Alias or hotkey that opens this profile directly
Raycast attaches aliases and hotkeys to commands and Quicklinks, not to list items. So this profile gets its own Quicklink:

1. Press **⌘L** here to create the Quicklink **${quicklinkName(profile)}** and save it.
2. Open Raycast Settings → Extensions (⌘⇧,) and search for **${quicklinkName(profile)}**.
3. Set its **Alias** (e.g. \`${example}\`) and/or **Hotkey** (e.g. Hyper + ${profile.name[0]?.toUpperCase() ?? "W"}).

Raycast does not let extensions read back which aliases or hotkeys you assigned, so that column lives in Raycast Settings.

## Deeplink
\`\`\`
${profileDeeplink(profile)}
\`\`\`
Use it anywhere that can open a URL: Quicklinks, Shortcuts.app, Keyboard Maestro, BetterTouchTool, a terminal (\`open '…'\`).`;
}

const COMMANDS = [
  {
    name: "open-profile",
    title: "Open Comet Profile",
    icon: Icon.Globe,
    markdown: `# Open Comet Profile

Opens a profile by **alias**, **name** or **directory**, with an optional URL as the second argument.

\`\`\`
Open Comet Profile work
Open Comet Profile work github.com
\`\`\`

**Tip:** give this command a short alias in Raycast Settings → Extensions (e.g. \`comet\`). Then \`comet work\` opens your work profile and \`comet personal\` opens the other one — one command, every profile.

Run it with no profile and it falls back to the picker.`,
  },
  {
    name: "switch-profile",
    title: "Switch Comet Profile",
    icon: Icon.List,
    markdown: `# Switch Comet Profile

The profile picker. Assign it a hotkey in Raycast Settings → Extensions if you want a single key that shows all profiles.

- **Enter** opens (or focuses) the profile
- **⌘Enter** opens a new window
- **⌘L** creates a Quicklink for the selected profile
- **⌘⇧S** jumps here`,
  },
] as const;

function AliasForm({
  profile,
  current,
  onSaved,
}: {
  profile: CometProfile;
  current: string[];
  onSaved: (all: AliasMap) => void;
}) {
  const { pop } = useNavigation();
  const [value, setValue] = useState(current.join(", "));
  return (
    <Form
      navigationTitle={`Aliases for ${profile.name}`}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Save Aliases"
            icon={Icon.Check}
            onSubmit={async () => {
              const aliases = parseAliasInput(value);
              const all = await setAliasesFor(profile.directory, aliases);
              onSaved(all);
              await showToast({
                style: Toast.Style.Success,
                title: aliases.length ? `Aliases saved for ${profile.name}` : `Aliases cleared for ${profile.name}`,
              });
              pop();
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="aliases"
        title="Aliases"
        placeholder="work, w"
        info="Comma-separated. Used by the Open Comet Profile command, e.g. “Open Comet Profile work”. An alias can only belong to one profile."
        value={value}
        onChange={setValue}
      />
      <Form.Description title="Profile" text={`${profile.name} (${profile.directory})`} />
    </Form>
  );
}

export default function Command() {
  const [profiles, setProfiles] = useState<CometProfile[]>(getProfiles);
  const [aliases, setAliases] = useState<AliasMap>({});
  const refresh = useCallback(() => setProfiles(getProfiles()), []);
  useEffect(() => {
    getAliases().then(setAliases);
  }, []);

  return (
    <List
      isShowingDetail
      navigationTitle="Comet Profile Shortcuts"
      searchBarPlaceholder="Search profiles and commands…"
    >
      <List.Section title="Profiles" subtitle={`${profiles.length}`}>
        {profiles.map((profile) => {
          const own = aliases[profile.directory] ?? [];
          return (
            <List.Item
              key={profile.directory}
              icon={profileIcon(profile)}
              title={profile.name}
              subtitle={own.length ? own.join(", ") : undefined}
              keywords={[profile.directory, ...own]}
              detail={
                <List.Item.Detail
                  markdown={profileMarkdown(profile, own)}
                  metadata={
                    <List.Item.Detail.Metadata>
                      <List.Item.Detail.Metadata.Label title="Directory" text={profile.directory} />
                      <List.Item.Detail.Metadata.TagList title="Aliases">
                        {own.length ? (
                          own.map((a) => (
                            <List.Item.Detail.Metadata.TagList.Item key={a} text={a} color={profile.color} />
                          ))
                        ) : (
                          <List.Item.Detail.Metadata.TagList.Item text="none" color={Color.SecondaryText} />
                        )}
                      </List.Item.Detail.Metadata.TagList>
                      <List.Item.Detail.Metadata.Label title="Quicklink name" text={quicklinkName(profile)} />
                      <List.Item.Detail.Metadata.Separator />
                      <List.Item.Detail.Metadata.Label title="Last used" text={profile.lastUsed ? "Yes" : "No"} />
                      <List.Item.Detail.Metadata.Label title="Window open" text={profile.active ? "Yes" : "No"} />
                    </List.Item.Detail.Metadata>
                  }
                />
              }
              actions={
                <ActionPanel>
                  <ActionPanel.Section title="Shortcuts">
                    <Action.Push
                      title="Edit Aliases"
                      icon={Icon.Pencil}
                      shortcut={Keyboard.Shortcut.Common.Edit}
                      target={<AliasForm profile={profile} current={own} onSaved={setAliases} />}
                    />
                    <Action.CreateQuicklink
                      title="Create Quicklink (Alias / Hotkey)"
                      icon={Icon.Link}
                      shortcut={{ modifiers: ["cmd"], key: "l" }}
                      quicklink={{ name: quicklinkName(profile), link: profileDeeplink(profile) }}
                    />
                    <Action
                      title="Open Raycast Settings"
                      icon={Icon.Gear}
                      shortcut={{ modifiers: ["cmd", "shift"], key: "," }}
                      onAction={openExtensionPreferences}
                    />
                    <Action.CopyToClipboard
                      title="Copy Deeplink"
                      content={profileDeeplink(profile)}
                      shortcut={Keyboard.Shortcut.Common.Copy}
                    />
                  </ActionPanel.Section>
                  <ActionPanel.Section>
                    <Action
                      title="Open Profile"
                      icon={Icon.Globe}
                      shortcut={Keyboard.Shortcut.Common.Open}
                      onAction={async () => {
                        await popToRoot();
                        await launchProfile(profile);
                        await showHUD(`Opening Comet · ${profile.name}`);
                      }}
                    />
                    <Action
                      title="Refresh Profiles"
                      icon={Icon.ArrowClockwise}
                      shortcut={Keyboard.Shortcut.Common.Refresh}
                      onAction={refresh}
                    />
                  </ActionPanel.Section>
                </ActionPanel>
              }
            />
          );
        })}
      </List.Section>
      <List.Section title="Commands">
        {COMMANDS.map((cmd) => (
          <List.Item
            key={cmd.name}
            icon={cmd.icon}
            title={cmd.title}
            detail={<List.Item.Detail markdown={cmd.markdown} />}
            actions={
              <ActionPanel>
                <Action
                  title="Set Alias or Hotkey in Raycast Settings"
                  icon={Icon.Gear}
                  onAction={openExtensionPreferences}
                />
                <Action.CopyToClipboard
                  title="Copy Command Deeplink"
                  content={commandDeeplink(cmd.name)}
                  shortcut={Keyboard.Shortcut.Common.Copy}
                />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}
