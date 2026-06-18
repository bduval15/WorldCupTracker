# World Cup 2026 Live

A Windows desktop app for following the FIFA World Cup 2026 from one live dashboard.
<img width="1180" height="778" alt="wCTracker" src="https://github.com/user-attachments/assets/c0612891-dc36-46a9-b807-061e4e3a4720" />


World Cup 2026 Live includes live match cards, group tables, standings, bracket paths, team favorites, player and team stats, timelines, goals, cards, and match detail pages.

## Download

Download the latest Windows build from the [GitHub Releases page](https://github.com/bduval15/WorldCupTracker/releases).

Choose one of the release assets:

- `World Cup 2026 Live Setup 1.0.0.exe` installs the app and creates shortcuts.
- `World Cup 2026 Live 1.0.0.exe` runs as a portable app without installing.

## Features

- Live score updates while the app is open.
- Home dashboard with Golden Boot, next kickoff, latest result, followed team, group leaders, and today's matches.
- Match Center with filters, search, live status, score summaries, cards, goals, and event previews.
- Dedicated Stats page for player goals, team goals, assists, yellow cards, red cards, and team standings.
- Groups page with all 12 group tables.
- Knockout bracket view from Round of 32 through the final.
- Match detail pages with live score, kickoff, location, officials, ESPN match link, stats, key events, and timeline.
- Favorite team selection with team-themed colors and quick team summary.
- Compact mode for a smaller desktop view.
- Offline fallback data if the live feed is unavailable.

## How To Use

1. Download either the installer or portable `.exe` from the Releases page.
2. Open the app.
3. Pick a favorite team from the sidebar if you want team-themed colors and quick team tracking.
4. Use `Update` to request the latest feed manually, or leave the app open for automatic refreshes.
5. Click any match card, live sidebar match, next kickoff card, or latest result card to open match details.

## Live Data

Live data is routed through a shared cached feed backed by public ESPN FIFA World Cup scoreboard and match summary endpoints. If the live source is unavailable, the app falls back to bundled tournament data.

The app uses short local caches and jittered refresh intervals to avoid excessive polling. During live matches, the app refreshes much more often than it does when no match is live.

## Privacy

World Cup 2026 Live does not require an account and does not collect analytics. Favorite team and compact mode preferences are stored locally on your device using browser local storage inside the Electron app.

## Build From Source

Requirements:

- Windows 10 or newer
- Node.js 20 or newer
- npm

Clone and install:

```powershell
git clone https://github.com/bduval15/WorldCupTracker.git
cd WorldCupTracker
npm install
```

Run from source:

```powershell
npm start
```

Run validation:

```powershell
npm test
```

Build the installer and portable `.exe` files:

```powershell
npm run dist
```

Generated builds are written to the project `release` folder. Do not commit generated `.exe` files to the repository; attach them to a GitHub Release instead.

## Tech Stack

- Electron
- Vanilla HTML, CSS, and JavaScript
- Electron Builder

## Disclaimer

This is an unofficial fan-made desktop app. It is not affiliated with, endorsed by, sponsored by, or connected to FIFA, ESPN, any broadcaster, or any national football association.

Team names, competition names, logos, flags, trademarks, and other sports-related identifiers belong to their respective owners. Live match data comes from third-party public endpoints and may be delayed, incomplete, unavailable, or inaccurate. This app is provided for informational and personal use only.

The software is provided "as is" without warranty of any kind. See the MIT License for the full license and warranty disclaimer.

## License

MIT
