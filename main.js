const { app, BrowserWindow, Notification, ipcMain, screen, shell } = require("electron");
const fs = require("fs");
const path = require("path");

const ESPN_SCOREBOARD =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?limit=300&dates=20260611-20260719";
const ESPN_SUMMARY =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=";
const ESPN_SOURCE = "https://www.espn.com/soccer/scoreboard/_/league/fifa.world";
const LIVE_FEED_CONFIG = readLiveFeedConfig();
const LIVE_FEED_BASE = cleanBaseUrl(process.env.WORLD_CUP_FEED_BASE || LIVE_FEED_CONFIG.baseUrl);
const LIVE_SCOREBOARD = process.env.WORLD_CUP_SCOREBOARD_URL || LIVE_FEED_CONFIG.scoreboardUrl || feedUrl("/scoreboard") || ESPN_SCOREBOARD;
const LIVE_SUMMARY = process.env.WORLD_CUP_SUMMARY_URL || LIVE_FEED_CONFIG.summaryUrl || feedUrl("/summary?event=") || ESPN_SUMMARY;
const SCOREBOARD_CACHE_MS = 15_000;
const SUMMARY_CACHE_MS = 45_000;
const APP_ICON = path.join(__dirname, "src", "assets", "soccer-ball.png");

let mainWindow;
const responseCache = new Map();

if (process.platform === "win32") {
  app.setAppUserModelId("com.bduval15.worldcup2026live");
}

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

function readLiveFeedConfig() {
  try {
    const configPath = path.join(__dirname, "src", "config", "live-feed.json");
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch {
    return {};
  }
}

function cleanBaseUrl(value = "") {
  return String(value || "").trim().replace(/\/+$/, "");
}

function feedUrl(pathname) {
  return LIVE_FEED_BASE ? `${LIVE_FEED_BASE}${pathname}` : "";
}

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

async function cachedFetchJson(key, url, ttlMs, force = false) {
  const cached = responseCache.get(key);
  if (!force && cached && Date.now() - cached.fetchedAtMs < ttlMs) {
    return { data: cached.data, fromCache: true, fetchedAt: cached.fetchedAt };
  }

  try {
    const data = await fetchJson(url);
    const entry = {
      data,
      fetchedAt: new Date().toISOString(),
      fetchedAtMs: Date.now()
    };
    responseCache.set(key, entry);
    return { ...entry, fromCache: false };
  } catch (error) {
    if (cached) return { data: cached.data, fromCache: true, stale: true, fetchedAt: cached.fetchedAt };
    throw error;
  }
}

ipcMain.handle("fetch-live-world-cup", async (_event, options = {}) => {
  const started = Date.now();
  const result = await cachedFetchJson("scoreboard", LIVE_SCOREBOARD, SCOREBOARD_CACHE_MS, Boolean(options.force));
  return {
    data: result.data,
    sourceName: result.fromCache ? "Recently updated FIFA World Cup scoreboard" : "ESPN FIFA World Cup scoreboard",
    sourceUrl: ESPN_SOURCE,
    fetchedAt: result.fetchedAt,
    fromCache: result.fromCache,
    stale: Boolean(result.stale),
    latencyMs: Date.now() - started
  };
});

ipcMain.handle("fetch-match-summary", async (_event, eventId, options = {}) => {
  if (!/^\d+$/.test(String(eventId))) {
    throw new Error("Invalid ESPN event id");
  }
  const result = await cachedFetchJson(`summary:${eventId}`, `${LIVE_SUMMARY}${eventId}`, SUMMARY_CACHE_MS, Boolean(options.force));
  return {
    data: result.data,
    sourceName: result.fromCache ? "Recently updated match summary" : "ESPN match summary",
    fetchedAt: result.fetchedAt,
    fromCache: result.fromCache,
    stale: Boolean(result.stale)
  };
});

ipcMain.handle("open-external", async (_event, url) => {
  if (typeof url === "string" && /^https?:\/\//.test(url)) {
    await shell.openExternal(url);
  }
});

ipcMain.handle("show-notification", async (_event, payload = {}) => {
  const title = String(payload.title || "").trim();
  const body = String(payload.body || "").trim();
  if (!title || !Notification.isSupported()) return false;
  new Notification({
    title,
    body,
    icon: APP_ICON
  }).show();
  return true;
});

ipcMain.handle("set-compact-mode", async (event, compact) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) return;
  const display = screen.getDisplayMatching(window.getBounds()).workAreaSize;

  if (window.isFullScreen()) window.setFullScreen(false);
  if (window.isMaximized()) window.unmaximize();

  if (compact) {
    const width = 460;
    const height = Math.min(720, display.height);
    window.setResizable(true);
    window.setMinimumSize(width, 520);
    window.setMaximumSize(width, display.height);
    window.setSize(width, height, true);
    window.center();
  } else {
    window.setResizable(true);
    window.setMinimumSize(920, 620);
    window.setMaximumSize(display.width, display.height);
    window.setSize(Math.min(1180, display.width), Math.min(780, display.height), true);
    window.center();
  }
});
