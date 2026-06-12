const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");

const ESPN_SCOREBOARD =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?limit=300&dates=20260611-20260719";
const ESPN_SUMMARY =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=";
const ESPN_SOURCE = "https://www.espn.com/soccer/scoreboard/_/league/fifa.world";
const APP_ICON = path.join(__dirname, "src", "assets", "soccer-ball.png");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 920,
    minHeight: 620,
    icon: APP_ICON,
    backgroundColor: "#07111f",
    title: "World Cup 2026 Live",
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#07111f",
      symbolColor: "#e6f1ff",
      height: 38
    },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "src", "index.html"));
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "accept": "application/json",
      "user-agent": "WorldCup2026Desktop/1.0 (local desktop app)"
    }
  });

  if (!response.ok) {
    throw new Error(`Live source returned ${response.status}`);
  }

  return response.json();
}

ipcMain.handle("fetch-live-world-cup", async () => {
  const started = Date.now();
  return {
    data: await fetchJson(ESPN_SCOREBOARD),
    sourceName: "ESPN FIFA World Cup scoreboard",
    sourceUrl: ESPN_SOURCE,
    fetchedAt: new Date().toISOString(),
    latencyMs: Date.now() - started
  };
});

ipcMain.handle("fetch-match-summary", async (_event, eventId) => {
  if (!/^\d+$/.test(String(eventId))) {
    throw new Error("Invalid ESPN event id");
  }
  return {
    data: await fetchJson(`${ESPN_SUMMARY}${eventId}`),
    sourceName: "ESPN match summary",
    fetchedAt: new Date().toISOString()
  };
});

ipcMain.handle("open-external", async (_event, url) => {
  if (typeof url === "string" && /^https?:\/\//.test(url)) {
    await shell.openExternal(url);
  }
});
