# Comet Profile Switcher

A [Raycast](https://raycast.com) extension that opens a specific [Comet](https://www.perplexity.ai/comet) browser profile instantly. Type `work` and hit Enter, or press a global hotkey, and Comet opens (or focuses) that profile.

**Every Comet profile becomes its own Raycast command.** That means each profile shows up in Raycast Settings → Extensions with its own **Alias** and **Hotkey** fields, exactly like any other command. No Quicklinks, no indirection.

![Each profile in Raycast Settings with its own alias and hotkey](metadata/comet-profile-switcher-2.png)

## Setup

```sh
git clone https://github.com/alexnicolai/comet-profile-switcher
cd comet-profile-switcher
npm install
npm run dev
```

`npm run dev` first reads your Comet profiles and generates one command per profile, then installs the extension into Raycast. Then:

1. Open Raycast Settings → **Extensions** → **Comet Profile Switcher**.
2. Next to each profile, set an **Alias** (e.g. `work`) and/or a **Hotkey** (e.g. Hyper + W).

Added, removed or renamed a profile in Comet? Run `npm run dev` (or `npm run sync`) again and the commands update.

## Commands

| Command | What it does |
| --- | --- |
| **\<profile name\>** (one per profile) | Opens that profile, focusing its window if one is open. Accepts an optional URL argument: `Myria github.com`. Each has its own icon in the profile's Comet colors. |
| **Switch Comet Profile** | A picker listing all profiles with a dot for open windows and a "Last used" tag. Enter opens, ⌘Enter opens a new window, ⌘E jumps to the alias/hotkey settings, ⌘C copies the profile's deeplink. |

![Switch Comet Profile](metadata/comet-profile-switcher-1.png)

## Deeplinks

Each profile command has a deeplink you can use from Shortcuts.app, Keyboard Maestro, BetterTouchTool or a terminal:

```
raycast://extensions/<you>/comet-profile-switcher/profile-profile-2
```

Copy it from the picker with ⌘C. When a deeplink is triggered from outside Raycast, Raycast asks for confirmation the first time; choose *Always Run Command*.

## Preferences

- **Comet Application**: only needed if Comet isn't in `/Applications`.
- **Comet Data Directory**: defaults to `~/Library/Application Support/Comet`. If you change it, also run the sync with `COMET_USER_DATA_DIR=/path npm run sync`.
- **Always open a new window**: by default an existing window for the profile is brought to the front; enable this to get a fresh window every time.

Focusing an existing window uses macOS accessibility to find the Comet window titled with that profile, so Raycast needs **Accessibility** access (System Settings → Privacy & Security → Accessibility). Without it the extension still works but always opens a new window, and tells you why.

## Performance

- No network, no background processes, no menu bar item.
- Comet's profile registry (`Local State`, about 1 MB) is parsed once and cached; it's re-read only when the file changes.
- Comet is launched through macOS `open`, so nothing stays attached to Raycast.

## How it works

Comet is Chromium-based. Its profiles live in `~/Library/Application Support/Comet/<directory>` and are listed in `Local State` under `profile.info_cache`, with the display name and theme colors.

`scripts/sync-profiles.mjs` reads that file and writes, for each profile, a command entry in `package.json`, a tiny `src/profile-<slug>.ts`, and an avatar icon in `assets/`. Opening a profile first looks for a Comet window whose title ends in ` - Comet - <profile>` and raises it. If there is none (or you asked for a new window / passed a URL), it runs:

```
open -na /Applications/Comet.app --args --profile-directory="Profile 2" [--new-window] [url]
```

A running Chromium always opens a new window for a bare `--profile-directory`, which is why the focus step comes first.

Because the commands are generated from *your* profiles, this extension is meant to be installed from source rather than the Raycast Store (Store extensions have a fixed command list).

## Development

```sh
npm run sync     # regenerate profile commands from Comet
npm run dev      # sync + install into Raycast with hot reload
npm run lint
npm run build
```

## License

MIT
