# World Cup 2026 Live

A Windows desktop app for following the FIFA World Cup 2026 from one live dashboard. It includes match cards, groups, standings, knockout bracket paths, search, scores, match stats, goals, cards, broadcasts, and event timelines while the app is open.

## Download

Download the latest Windows build from the GitHub Releases page:

```text
https://github.com/bduval15/WorldCupTracker/releases
```

Use one of the release assets:

- `World Cup 2026 Live Setup 1.0.0.exe` installs the app and creates shortcuts.
- `World Cup 2026 Live 1.0.0.exe` runs as a portable app with no install step.

## Features

- Live score sync while the app is open.
- Today view with top scorers, group leaders, next kickoff, and latest result.
- Match Center with filtering and searchable teams, players, and matches.
- Group tables for all 12 World Cup groups.
- Official knockout bracket path ordering from Round of 32 through the final.
- Match detail modal with stats, goals, cards, broadcasts, officials, and timeline.
- Dark World Cup themed interface with team flags and soccer ball app icon.
- Offline fallback data when the live source cannot be reached.

## Data Source

Live data is fetched from ESPN's public FIFA World Cup scoreboard and match summary endpoints. If the live source is unavailable, the app falls back to bundled tournament data.

## Disclaimer

This is an unofficial fan-made desktop app. It is not affiliated with, endorsed by, sponsored by, or connected to FIFA, ESPN, any broadcaster, or any national football association.

Team names, competition names, logos, flags, trademarks, and other sports-related identifiers belong to their respective owners. Live match data comes from third-party public endpoints and may be delayed, incomplete, unavailable, or inaccurate. This app is provided for informational and personal use only.

The software is provided "as is" without warranty of any kind. See the MIT License for the full license and warranty disclaimer.

## Build Your Own Copy

Requirements:

- Windows 10 or newer
- Node.js 20 or newer
- npm

Clone the repository and install dependencies:

```powershell
git clone https://github.com/bduval15/WorldCupTracker.git
cd WorldCupTracker
npm install
```

Run it from source:

```powershell
npm start
```

Build installer and portable `.exe` files:

```powershell
npm run dist
```

The generated files will be in:

```powershell
release
```

If Windows or OneDrive blocks the project `release` folder during packaging, build to your Desktop instead:

```powershell
npm run dist:desktop
```

The generated files will be in:

```powershell
%USERPROFILE%\Desktop\WorldCup2026LiveRelease
```

Use either generated file:

- `World Cup 2026 Live Setup 1.0.0.exe`
- `World Cup 2026 Live 1.0.0.exe`

Do not commit the generated `.exe` files to the repository. Upload them to GitHub Releases instead.

## Validate

Run syntax checks before committing or releasing:

```powershell
npm test
```

## Tech Stack

- Electron
- Vanilla HTML, CSS, and JavaScript
- Electron Builder for Windows packaging

## License

MIT
