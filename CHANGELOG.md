# Comet Profile Switcher Changelog

## [Initial Version] - 2026-09-17

- One generated command per Comet profile, so every profile gets its own alias and hotkey in Raycast Settings. Icons are drawn in each profile's Comet colors.
- **Switch Comet Profile**: picker listing all profiles with open-window and last-used indicators, new-window action, and deeplink copying.
- `npm run sync` (run automatically by `npm run dev` and `npm run build`) regenerates the commands from Comet's profile registry.
