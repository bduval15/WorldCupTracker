const groupLetters = Object.keys(window.SEED_DATA.groups);
const INITIAL_REFRESH_MIN_MS = 5_000;
const INITIAL_REFRESH_MAX_MS = 20_000;
const IDLE_REFRESH_MIN_MS = 3 * 60_000;
const IDLE_REFRESH_MAX_MS = 5 * 60_000;
const LIVE_REFRESH_MIN_MS = 15_000;
const LIVE_REFRESH_MAX_MS = 25_000;
const SUMMARY_LIVE_MS = 30_000;
const SUMMARY_FINAL_MS = 12 * 60 * 60_000;
const summaryFetchedAt = new Map();
const notifiedEvents = new Set(readJsonSetting("notifiedEvents", []));
let refreshTimer = null;
let refreshInFlight = false;
let notificationsReady = false;

function readJsonSetting(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

const state = {
  view: "today",
  statsTab: "playerGoals",
  query: "",
  matchGroupFilter: "",
  favoriteTeam: localStorage.getItem("favoriteTeam") || "",
  compactMode: localStorage.getItem("compactMode") === "true",
  alerts: {
    kickoff: localStorage.getItem("alertKickoff") === "true",
    goals: localStorage.getItem("alertGoals") === "true",
    final: localStorage.getItem("alertFinal") === "true",
    red: localStorage.getItem("alertRed") === "true"
  },
  source: "Bundled fallback",
  sourceUrl: "",
  lastUpdated: null,
  liveError: null,
  groups: structuredClone(window.SEED_DATA.groups),
  standings: {},
  matches: createSeedMatches(),
  selectedMatch: null,
  selectedSummary: null
};

const viewTitles = {
  today: "Home",
  matches: "Match Center",
  stats: "Stats",
  groups: "Groups",
  bracket: "Knockout"
};

const searchPlaceholders = {
  today: "Search teams, groups, matches",
  matches: "Search teams, groups, dates, scores, status",
  stats: "Search player names, teams, stats",
  groups: "Search groups or teams",
  bracket: "Search teams, rounds, match numbers"
};

const statsTabs = [
  { id: "playerGoals", label: "Player Goals", icon: "soccer-ball.svg" },
  { id: "teamGoals", label: "Team Goals", icon: "team-goals.svg" },
  { id: "assists", label: "Assists", icon: "assist.svg" },
  { id: "yellows", label: "Yellows", icon: "yellow-card.svg" },
  { id: "reds", label: "Reds", icon: "red-card.svg" },
  { id: "teams", label: "Teams", icon: "teams.svg" }
];

const stageOrder = [
  "Round of 32",
  "Round of 16",
  "Quarterfinals",
  "Semifinals",
  "Final"
];

const bracketVisualOrder = {
  "Round of 32": [73, 75, 74, 77, 83, 84, 81, 82, 76, 78, 79, 80, 86, 88, 85, 87],
  "Round of 16": [89, 90, 93, 94, 91, 92, 95, 96],
  Quarterfinals: [97, 98, 99, 100],
  Semifinals: [101, 102],
  Final: [104]
};

const officialMatchByEntrants = new Map([
  ["2A|2B", 73],
  ["1E|3ABCDF", 74],
  ["1F|2C", 75],
  ["1C|2F", 76],
  ["1I|3CDFGH", 77],
  ["2E|2I", 78],
  ["1A|3CEFHI", 79],
  ["1L|3EHIJK", 80],
  ["1D|3BEFIJ", 81],
  ["1G|3AEHIJ", 82],
  ["2K|2L", 83],
  ["1H|2J", 84],
  ["1B|3EFGIJ", 85],
  ["1J|2H", 86],
  ["1K|3DEIJL", 87],
  ["2D|2G", 88],
  ["W73|W75", 89],
  ["W74|W77", 90],
  ["W76|W78", 91],
  ["W79|W80", 92],
  ["W83|W84", 93],
  ["W81|W82", 94],
  ["W86|W88", 95],
  ["W85|W87", 96],
  ["W89|W90", 97],
  ["W93|W94", 98],
  ["W91|W92", 99],
  ["W95|W96", 100],
  ["W97|W98", 101],
  ["W99|W100", 102],
  ["W101|W102", 104]
]);

const teamCodes = {
  Algeria: "ALG", Argentina: "ARG", Australia: "AUS", Austria: "AUT", Belgium: "BEL",
  "Bosnia and Herzegovina": "BIH", "Bosnia-Herzegovina": "BIH", Brazil: "BRA", Canada: "CAN",
  "Cape Verde": "CPV", Colombia: "COL", Croatia: "CRO", Curacao: "CUW", "Curaçao": "CUW",
  "Czech Republic": "CZE", Czechia: "CZE", "DR Congo": "COD", Ecuador: "ECU", Egypt: "EGY",
  England: "ENG", France: "FRA", Germany: "GER", Ghana: "GHA", Haiti: "HAI", Iran: "IRN",
  Iraq: "IRQ", "Ivory Coast": "CIV", Japan: "JPN", Jordan: "JOR", Mexico: "MEX", Morocco: "MAR",
  Netherlands: "NED", "New Zealand": "NZL", Norway: "NOR", Panama: "PAN", Paraguay: "PAR",
  Portugal: "POR", Qatar: "QAT", "Saudi Arabia": "KSA", Scotland: "SCO", Senegal: "SEN",
  "South Africa": "RSA", "South Korea": "KOR", Spain: "ESP", Sweden: "SWE", Switzerland: "SUI",
  Tunisia: "TUN", Turkey: "TUR", "Turkiye": "TUR", "Türkiye": "TUR", "United States": "USA", Uruguay: "URU",
  Uzbekistan: "UZB"
};

const teamFlagCodes = {
  Algeria: "dz", Argentina: "ar", Australia: "au", Austria: "at", Belgium: "be",
  "Bosnia and Herzegovina": "ba", "Bosnia-Herzegovina": "ba", Brazil: "br", Canada: "ca",
  "Cape Verde": "cv", Colombia: "co", Croatia: "hr", Curacao: "cw", "Curaçao": "cw",
  "Czech Republic": "cz", Czechia: "cz", "DR Congo": "cd", "Congo DR": "cd", Ecuador: "ec",
  Egypt: "eg", England: "gb-eng", France: "fr", Germany: "de", Ghana: "gh", Haiti: "ht",
  Iran: "ir", Iraq: "iq", "Ivory Coast": "ci", Japan: "jp", Jordan: "jo", Mexico: "mx",
  Morocco: "ma", Netherlands: "nl", "New Zealand": "nz", Norway: "no", Panama: "pa",
  Paraguay: "py", Portugal: "pt", Qatar: "qa", "Saudi Arabia": "sa", Scotland: "gb-sct",
  Senegal: "sn", "South Africa": "za", "South Korea": "kr", Spain: "es", Sweden: "se",
  Switzerland: "ch", Tunisia: "tn", Turkey: "tr", "Turkiye": "tr", "Türkiye": "tr", "United States": "us",
  Uruguay: "uy", Uzbekistan: "uz"
};

const teamThemes = {
  Argentina: ["#75aadb", "#ffffff", "#f6c85f"], Australia: ["#ffcd00", "#00843d", "#ffffff"],
  Belgium: ["#fae042", "#ed2939", "#000000"], Brazil: ["#f7d117", "#009b3a", "#002776"],
  Canada: ["#ff2b3d", "#ffffff", "#d80621"], Colombia: ["#fcd116", "#003893", "#ce1126"],
  Croatia: ["#ff2b3d", "#ffffff", "#171796"], England: ["#ffffff", "#ce1124", "#1d428a"],
  France: ["#0055a4", "#ffffff", "#ef4135"], Germany: ["#ffce00", "#dd0000", "#000000"],
  Japan: ["#ffffff", "#bc002d", "#223049"], Mexico: ["#006847", "#ffffff", "#ce1126"],
  Morocco: ["#c1272d", "#006233", "#ffffff"], Netherlands: ["#ff6f1a", "#ffffff", "#21468b"],
  Portugal: ["#006600", "#ff0000", "#ffcc00"], Spain: ["#aa151b", "#f1bf00", "#ffffff"],
  "South Korea": ["#ffffff", "#c60c30", "#003478"], "United States": ["#3c3b6e", "#b22234", "#ffffff"],
  Uruguay: ["#75aadb", "#ffffff", "#fcd116"]
};

const fallbackTheme = ["#11c58d", "#f8cf52", "#d92945"];

const statLabels = {
  possessionPct: "Possession",
  totalShots: "Shots",
  shotsOnTarget: "On goal",
  totalGoals: "Goals",
  goalAssists: "Assists",
  wonCorners: "Corners",
  foulsCommitted: "Fouls",
  yellowCards: "Yellow cards",
  redCards: "Red cards",
  offsides: "Offsides",
  saves: "Saves",
  totalPasses: "Passes",
  accuratePasses: "Accurate passes",
  passPct: "Pass %",
  blockedShots: "Blocked shots",
  interceptions: "Interceptions"
};

const els = {
  root: document.getElementById("viewRoot"),
  summary: document.getElementById("summary"),
  title: document.getElementById("viewTitle"),
  search: document.getElementById("searchInput"),
  refresh: document.getElementById("refreshButton"),
  liveStatus: document.getElementById("liveStatus"),
  liveDetail: document.getElementById("liveDetail"),
  compactLiveStatus: document.getElementById("compactLiveStatus"),
  compactLiveDetail: document.getElementById("compactLiveDetail"),
  sidebarLiveMatch: document.getElementById("sidebarLiveMatch"),
  brandMark: document.getElementById("brandMark"),
  brandSubtitle: document.getElementById("brandSubtitle"),
  favoriteSelect: document.getElementById("favoriteTeamSelect"),
  compactButton: document.getElementById("compactModeButton"),
  compactNavButton: document.getElementById("compactNavButton"),
  alertKickoff: document.getElementById("kickoffAlerts"),
  alertGoals: document.getElementById("goalAlerts"),
  alertFinal: document.getElementById("finalAlerts"),
  alertRed: document.getElementById("redCardAlerts"),
  dialog: document.getElementById("matchDialog"),
  dialogBody: document.getElementById("matchDialogBody")
};

recalculateStandings();
initFavoriteSelect();
initPreferenceControls();
applyCompactMode(state.compactMode);
render();
scheduleNextRefresh(randomMs(INITIAL_REFRESH_MIN_MS, INITIAL_REFRESH_MAX_MS));

document.querySelectorAll(".nav-button").forEach((button) => {
  if (!button.dataset.view) return;
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-button[data-view]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.view = button.dataset.view;
    render();
  });
});

els.search.addEventListener("input", (event) => {
  state.query = event.target.value.trim().toLowerCase();
  render();
});

els.favoriteSelect.addEventListener("change", (event) => {
  state.favoriteTeam = event.target.value;
  if (state.favoriteTeam) localStorage.setItem("favoriteTeam", state.favoriteTeam);
  else localStorage.removeItem("favoriteTeam");
  updateFavoriteIdentity();
  applyFavoriteTheme();
  render();
});

els.compactButton.addEventListener("click", () => {
  applyCompactMode(!state.compactMode);
});

els.compactNavButton.addEventListener("click", () => {
  applyCompactMode(!state.compactMode);
});

[
  ["kickoff", els.alertKickoff],
  ["goals", els.alertGoals],
  ["final", els.alertFinal],
  ["red", els.alertRed]
].forEach(([key, input]) => {
  input.addEventListener("change", () => {
    state.alerts[key] = input.checked;
    localStorage.setItem(`alert${titleCase(key)}`, String(input.checked));
    if (input.checked) requestNotificationPermission();
  });
});

els.refresh.addEventListener("click", () => refreshLive({ force: true }));

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  } else {
    scheduleNextRefresh(randomMs(5_000, 15_000));
  }
});

function scheduleNextRefresh(delayMs = nextRefreshDelay()) {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => refreshLive(), delayMs);
}

function nextRefreshDelay() {
  const hasLive = state.matches.some((match) => match.statusState === "in");
  return hasLive
    ? randomMs(LIVE_REFRESH_MIN_MS, LIVE_REFRESH_MAX_MS)
    : randomMs(IDLE_REFRESH_MIN_MS, IDLE_REFRESH_MAX_MS);
}

function randomMs(min, max) {
  return Math.round(min + Math.random() * (max - min));
}

async function refreshLive(options = {}) {
  if (refreshInFlight) return;
  refreshInFlight = true;
  setLiveStatus("Syncing", "ESPN live");
  try {
    const previousMatches = new Map(state.matches.filter((match) => match.id).map((match) => [match.id, match]));
    const payload = await window.worldCup.fetchLive({ force: Boolean(options.force) });
    const parsed = parseEspnScoreboard(payload.data);
    if (parsed.matches.length) {
      await hydrateMatchSummaries(parsed.matches, options);
      state.matches = parsed.matches;
      state.groups = { ...state.groups, ...parsed.groups };
      state.source = payload.sourceName;
      state.sourceUrl = payload.sourceUrl;
      state.lastUpdated = payload.fetchedAt;
      state.liveError = null;
      recalculateStandings(false);
      initFavoriteSelect();
      maybeNotifyMatchEvents(parsed.matches, previousMatches);
      setLiveStatus(payload.stale ? "Offline cache" : payload.fromCache ? "Updated" : "Live", formatDateTime(payload.fetchedAt));
    } else {
      throw new Error("ESPN returned no World Cup events.");
    }
  } catch (error) {
    state.liveError = error.message;
    setLiveStatus("Offline data", error.message || "Sync unavailable");
  } finally {
    refreshInFlight = false;
    if (!document.hidden) scheduleNextRefresh();
  }
  render();
}

async function hydrateMatchSummaries(matches, options = {}) {
  const previous = new Map(state.matches.filter((match) => match.id).map((match) => [match.id, match]));
  matches.forEach((match) => {
    const old = previous.get(match.id);
    if (!old) return;
    if (Object.keys(old.stats || {}).length) match.stats = old.stats;
    if (old.details?.length) {
      match.details = old.details;
      match.goals = old.goals || [];
      match.cards = old.cards || [];
    }
  });
  const hydrateable = matches.filter((match) => shouldHydrateSummary(match, options.force));
  await Promise.allSettled(hydrateable.map(async (match) => {
    const payload = await window.worldCup.fetchMatchSummary(match.id, { force: Boolean(options.force) });
    const summary = normalizeSummary(payload.data);
    summaryFetchedAt.set(match.id, Date.now());
    if (summary.stats && Object.keys(summary.stats).length) match.stats = summary.stats;
    if (summary.plays.length) {
      match.details = summary.plays;
      match.goals = summary.plays.filter((detail) => detail.kind === "goal");
      match.cards = summary.plays.filter((detail) => detail.kind === "yellow" || detail.kind === "red");
    }
  }));
}

function shouldHydrateSummary(match, force = false) {
  if (!match.id || match.statusState === "pre") return false;
  if (force) return true;
  const lastFetched = summaryFetchedAt.get(match.id) || 0;
  const age = Date.now() - lastFetched;
  if (!lastFetched && (!match.details?.length || !Object.keys(match.stats || {}).length)) return true;
  if (match.statusState === "in") return age > SUMMARY_LIVE_MS;
  return age > SUMMARY_FINAL_MS;
}

function parseEspnScoreboard(data) {
  const groups = {};
  const matches = (data.events || []).map((event, index) => normalizeEspnEvent(event, index + 1)).filter(Boolean);
  matches.forEach((match) => {
    if (match.group && !groups[match.group]) groups[match.group] = [];
    if (match.group) {
      [match.home, match.away].forEach((team) => {
        if (team && !/Winner|Runner-up|3rd Group|Loser|Semifinal|Quarterfinal|Round of 16/.test(team) && !groups[match.group].includes(team)) {
          groups[match.group].push(team);
        }
      });
    }
  });
  return { groups, matches };
}

function normalizeEspnEvent(event, fallbackNumber) {
  const competition = event.competitions?.[0];
  const competitors = competition?.competitors || [];
  if (!competition || competitors.length < 2) return null;
  const home = competitors.find((team) => team.homeAway === "home") || competitors[0];
  const away = competitors.find((team) => team.homeAway === "away") || competitors[1];
  const note = competition.altGameNote || event.season?.slug || "";
  const group = note.match(/Group ([A-L])/i)?.[1]?.toUpperCase() || "";
  const stage = group ? "Group stage" : normalizeStage(event.season?.slug || note || "Knockout");
  const status = competition.status?.type || event.status?.type || {};
  const links = Object.fromEntries((event.links || []).map((link) => [link.shortText || link.text, link.href]));
  const stats = Object.fromEntries(competitors.map((item) => [item.team.displayName, mapStats(item.statistics || [])]));
  const details = (competition.details || []).map((detail) => normalizeDetail(detail, competitors)).filter(Boolean);

  return {
    id: event.id,
    number: Number(event.id) || fallbackNumber,
    group,
    stage,
    home: home.team.displayName,
    away: away.team.displayName,
    homeAbbr: home.team.abbreviation,
    awayAbbr: away.team.abbreviation,
    homeLogo: home.team.logo || "",
    awayLogo: away.team.logo || "",
    homeScore: status.state === "pre" ? null : Number(home.score),
    awayScore: status.state === "pre" ? null : Number(away.score),
    status: status.detail || status.description || "Scheduled",
    statusState: status.state || "pre",
    completed: Boolean(status.completed),
    date: competition.date || event.date,
    time: formatKickoff(competition.date || event.date),
    venue: competition.venue?.fullName || event.venue?.displayName || "TBD",
    city: competition.venue?.address?.city || "",
    country: competition.venue?.address?.country || "",
    attendance: competition.attendance || 0,
    broadcasts: (competition.broadcasts || []).flatMap((broadcast) => broadcast.names || []),
    stats,
    details,
    goals: details.filter((detail) => detail.kind === "goal"),
    cards: details.filter((detail) => detail.kind === "yellow" || detail.kind === "red"),
    headline: competition.headlines?.[0]?.description || "",
    links,
    source: "ESPN FIFA World Cup scoreboard"
  };
}

function normalizeDetail(detail, competitors = []) {
  const text = detail.type?.text || detail.play?.type?.text || "";
  const teamId = String(detail.team?.id || detail.play?.team?.id || "");
  const team = competitors.find((item) => String(item.id) === teamId || String(item.team?.id) === teamId)?.team?.displayName || detail.team?.displayName || detail.play?.team?.displayName || "";
  const athletes = extractParticipantNames(detail);
  const athlete = athletes[0] || "";
  const assist = athletes[1] || extractAssistName(detail.text || detail.play?.text || "");
  const detailText = detail.play?.text || detail.text || [athlete, text].filter(Boolean).join(" - ");
  const lower = `${text} ${detailText}`.toLowerCase();
  const ownGoal = /\bown goal\b/.test(lower);
  let kind = "event";
  if (detail.scoringPlay || lower.includes("goal")) kind = "goal";
  if (!detail.scoringPlay && lower.includes("assist")) kind = "assist";
  if (detail.yellowCard || lower.includes("yellow")) kind = "yellow";
  if (detail.redCard || lower.includes("red card")) kind = "red";
  if (lower.includes("substitution")) kind = "sub";
  return {
    kind,
    minute: detail.clock?.displayValue || detail.time?.displayValue || "",
    team,
    athlete,
    assist,
    ownGoal,
    text: detailText,
    type: text
  };
}

function mapStats(stats) {
  return Object.fromEntries(stats.map((stat) => [stat.name, {
    label: stat.label || stat.displayName || statLabels[stat.name] || stat.abbreviation || stat.name,
    value: stat.displayValue ?? String(stat.value ?? "")
  }]));
}

function extractParticipantNames(detail) {
  const groups = [detail.athletesInvolved, detail.participants, detail.play?.participants];
  const source = groups.find((items) => Array.isArray(items) && items.length) || [];
  return source.map((item) => item.displayName || item.athlete?.displayName).filter(Boolean);
}

async function openMatch(match) {
  state.selectedMatch = match;
  state.selectedSummary = null;
  renderMatchDialog(match);
  els.dialog.showModal();

  if (!match.id || !window.worldCup.fetchMatchSummary) return;
  try {
    const payload = await window.worldCup.fetchMatchSummary(match.id);
    summaryFetchedAt.set(match.id, Date.now());
    state.selectedSummary = normalizeSummary(payload.data);
    renderMatchDialog(match, state.selectedSummary);
  } catch (error) {
    state.selectedSummary = { error: error.message };
    renderMatchDialog(match, state.selectedSummary);
  }
}

async function refreshSelectedMatch(button) {
  if (!state.selectedMatch?.id) return;
  if (button) {
    button.disabled = true;
    button.textContent = "Updating...";
  }
  const matchId = state.selectedMatch.id;
  try {
    await refreshLive({ force: true });
    const latestMatch = state.matches.find((match) => match.id === matchId) || state.selectedMatch;
    state.selectedMatch = latestMatch;
    if (window.worldCup.fetchMatchSummary) {
      const payload = await window.worldCup.fetchMatchSummary(matchId, { force: true });
      summaryFetchedAt.set(matchId, Date.now());
      state.selectedSummary = normalizeSummary(payload.data);
    }
    renderMatchDialog(state.selectedMatch, state.selectedSummary);
  } catch (error) {
    state.selectedSummary = { error: error.message };
    renderMatchDialog(state.selectedMatch, state.selectedSummary);
  }
}

function normalizeSummary(summary) {
  const teams = summary.boxscore?.teams || [];
  const competitors = summary.header?.competitions?.[0]?.competitors || [];
  const stats = Object.fromEntries(teams.map((item) => [item.team.displayName, mapStats(item.statistics || [])]));
  const keyEvents = (summary.keyEvents || []).map((play) => normalizeDetail(play, competitors)).filter((play) => play.text || play.type);
  const commentary = (summary.commentary || []).map((item) => normalizeDetail(item.play || item, competitors)).filter((play) => play.text || play.type);
  const plays = uniqueEvents(keyEvents.concat(commentary));
  const officials = (summary.gameInfo?.officials || []).map((official) => official.displayName || official.fullName).filter(Boolean);
  const standings = summary.standings?.groups || [];
  return {
    stats,
    plays,
    officials,
    attendance: summary.gameInfo?.attendance || 0,
    standings
  };
}

function uniqueEvents(events) {
  const seen = new Set();
  return events.filter((event) => {
    const key = [event.minute, event.kind, event.athlete, event.text].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function render() {
  els.title.textContent = viewTitles[state.view];
  updateFavoriteIdentity();
  updateSearchUi();
  renderSidebarLiveMatch();
  renderSummary();
  const renderers = { today: renderToday, matches: renderMatches, stats: renderStats, groups: renderGroups, bracket: renderBracket };
  els.root.innerHTML = "";
  els.root.appendChild(renderers[state.view]());
}

function renderSidebarLiveMatch() {
  const liveMatches = state.matches.filter((match) => match.statusState === "in");
  const match = liveMatches[0] || upcomingMatches()[0];
  if (!match) {
    els.sidebarLiveMatch.innerHTML = `
      <span class="sidebar-live-label">Live</span>
      <strong>No matches live</strong>
      <small>Schedule complete</small>
    `;
    els.sidebarLiveMatch.removeAttribute("tabindex");
    els.sidebarLiveMatch.onclick = null;
    els.sidebarLiveMatch.onkeydown = null;
    return;
  }

  const isLive = match.statusState === "in";
  els.sidebarLiveMatch.innerHTML = `
    <span class="sidebar-live-label">${isLive ? "Live" : "Next"}</span>
    <strong>${escapeHtml(match.homeAbbr || codeForTeam(match.home))} ${scoreText(match)} ${escapeHtml(match.awayAbbr || codeForTeam(match.away))}</strong>
    <small>${escapeHtml(isLive ? match.status : `${formatMatchDate(match.date)} ${match.time}`)}${liveMatches.length > 1 ? ` / ${liveMatches.length} live` : ""}</small>
    ${isLive || match.completed ? sidebarLiveStats(match) : ""}
    ${isLive || match.completed ? sidebarLiveEvents(match) : ""}
  `;
  els.sidebarLiveMatch.tabIndex = 0;
  els.sidebarLiveMatch.onclick = () => openMatch(match);
  els.sidebarLiveMatch.onkeydown = (event) => { if (event.key === "Enter") openMatch(match); };
}

function sidebarLiveStats(match) {
  const yellow = match.cards.filter((card) => card.kind === "yellow").length || sidebarMatchStat(match, "yellowCards");
  const red = match.cards.filter((card) => card.kind === "red").length || sidebarMatchStat(match, "redCards");
  const shots = sidebarMatchStat(match, "totalShots");
  const items = [
    [`${match.goals.length}`, "goals"],
    [`${yellow}`, "yellow"],
    [`${red}`, "red"]
  ];
  if (shots) items.push([String(shots), "shots"]);
  return `<div class="sidebar-live-stats">${items.map(([value, label]) => `
    <span><b>${escapeHtml(value)}</b>${escapeHtml(label)}</span>
  `).join("")}</div>`;
}

function sidebarMatchStat(match, key) {
  return [match.home, match.away].reduce((total, team) => {
    const raw = match.stats[team]?.[key]?.value;
    const value = Number.parseFloat(String(raw ?? "").replace("%", ""));
    return total + (Number.isFinite(value) ? value : 0);
  }, 0);
}

function sidebarLiveEvents(match) {
  const events = uniqueEvents(match.goals.concat(match.cards, match.details || []))
    .filter(isTimelineEvent)
    .sort((a, b) => sortEventsByMinute(b, a))
    .slice(0, 5);
  if (!events.length) return "";
  return `<ol class="sidebar-live-events">${events.map((event) => `
    <li class="${escapeHtml(event.kind)}">
      <span>${escapeHtml(event.minute || "")}</span>
      <strong>${escapeHtml(eventLabel(event))}</strong>
    </li>
  `).join("")}</ol>`;
}

function updateSearchUi() {
  els.search.placeholder = searchPlaceholders[state.view] || "Search teams and matches";
  els.search.disabled = false;
  els.search.removeAttribute("aria-disabled");
}

function initFavoriteSelect() {
  const teams = allTeams();
  if (state.favoriteTeam && !teams.includes(state.favoriteTeam)) {
    state.favoriteTeam = "";
    localStorage.removeItem("favoriteTeam");
  }
  els.favoriteSelect.innerHTML = [
    `<option value="">Choose a team</option>`,
    ...teams.map((team) => `<option value="${escapeHtml(team)}">${escapeHtml(team)}</option>`)
  ].join("");
  els.favoriteSelect.value = state.favoriteTeam;
  updateFavoriteIdentity();
}

function initPreferenceControls() {
  els.alertKickoff.checked = state.alerts.kickoff;
  els.alertGoals.checked = state.alerts.goals;
  els.alertFinal.checked = state.alerts.final;
  els.alertRed.checked = state.alerts.red;
  els.compactButton.setAttribute("aria-pressed", String(state.compactMode));
  els.compactNavButton.setAttribute("aria-pressed", String(state.compactMode));
  if (Object.values(state.alerts).some(Boolean)) requestNotificationPermission();
}

function updateFavoriteIdentity() {
  const favorite = state.favoriteTeam;
  const flag = favorite ? flagUrlForTeam(favorite, "w160") : "";
  const mark = els.brandMark.closest(".brand-mark");
  els.brandMark.src = flag || "assets/soccer-ball.svg";
  els.brandMark.classList.toggle("is-flag", Boolean(flag));
  mark?.classList.toggle("is-favorite", Boolean(flag));
  els.brandSubtitle.textContent = favorite || "2026 Matchday";
  els.favoriteSelect.value = favorite;
  applyFavoriteTheme();
}

function applyFavoriteTheme() {
  const [primary, secondary, third] = teamThemes[state.favoriteTeam] || fallbackTheme;
  document.documentElement.style.setProperty("--team-primary", primary);
  document.documentElement.style.setProperty("--team-secondary", secondary);
  document.documentElement.style.setProperty("--team-third", third);
  document.documentElement.style.setProperty("--trophy", `linear-gradient(90deg, ${primary}, ${secondary}, ${third})`);
}

function applyCompactMode(enabled) {
  state.compactMode = enabled;
  localStorage.setItem("compactMode", String(enabled));
  document.body.classList.toggle("compact-mode", enabled);
  els.compactButton.textContent = enabled ? "Full" : "Compact";
  els.compactNavButton.textContent = enabled ? "Full" : "Compact";
  els.compactButton.setAttribute("aria-pressed", String(enabled));
  els.compactNavButton.setAttribute("aria-pressed", String(enabled));
  window.worldCup.setCompactMode?.(enabled);
}

function requestNotificationPermission() {
  if (!("Notification" in window) || Notification.permission !== "default") return;
  Notification.requestPermission().catch(() => {});
}

function showLocalNotification(title, body) {
  if (window.worldCup?.showNotification) {
    window.worldCup.showNotification({ title, body }).catch(() => {});
    return;
  }
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, {
      body,
      icon: "assets/soccer-ball.png",
      silent: false
    });
  }
}

function rememberNotification(key) {
  notifiedEvents.add(key);
  while (notifiedEvents.size > 300) notifiedEvents.delete(notifiedEvents.values().next().value);
  localStorage.setItem("notifiedEvents", JSON.stringify([...notifiedEvents]));
}

function renderSummary() {
  const metrics = tournamentMetrics();
  els.summary.innerHTML = [
    summaryCard("Golden boot", metrics.leadingScorer.name, metrics.leadingScorer.detail),
    summaryCard("Next kickoff", metrics.nextMatch.value, metrics.nextMatch.detail, metrics.nextMatch.match ? "next" : ""),
    summaryCard("Latest result", metrics.latestResult.value, metrics.latestResult.detail, metrics.latestResult.match ? "latest" : "")
  ].join("");
  bindSummaryMatchCard("next", metrics.nextMatch.match);
  bindSummaryMatchCard("latest", metrics.latestResult.match);
}

function bindSummaryMatchCard(action, match) {
  if (!action || !match) return;
  const card = els.summary.querySelector(`[data-summary-action="${action}"]`);
  if (!card) return;
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Open ${card.querySelector("span")?.textContent || "match"} details`);
  card.addEventListener("click", () => openMatch(match));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openMatch(match);
    }
  });
}

function renderToday() {
  const wrap = div("stack");
  wrap.append(tournamentPulse());
  const today = todayMatches();
  const matches = filterMatches(today.length ? today : upcomingMatches().slice(0, 10));
  wrap.append(sectionTitle(today.length ? "Today's Matches" : "Next Matches"));
  wrap.append(matchGrid(matches, true));
  wrap.append(sectionTitle("Latest Final Results"));
  wrap.append(matchGrid(filterMatches(recentResults().slice(0, 6)), false));
  return wrap;
}

function renderMatches() {
  const wrap = div("match-center");
  const filters = div("filter-row");
  const groupSelect = document.createElement("select");
  groupSelect.className = "group-filter";
  groupSelect.setAttribute("aria-label", "Filter matches by group");
  groupSelect.innerHTML = [
    `<option value="">All groups</option>`,
    ...groupLetters.map((group) => `<option value="${group}">Group ${group}</option>`)
  ].join("");
  groupSelect.value = state.matchGroupFilter;
  groupSelect.addEventListener("change", (event) => {
    state.matchGroupFilter = event.target.value;
    render();
  });
  filters.append(groupSelect);
  ["All", "Live", "Finished", "Upcoming"].forEach((label) => {
    const chip = document.createElement("button");
    chip.className = "filter-chip";
    chip.textContent = label;
    chip.addEventListener("click", () => {
      state.query = label === "All" ? "" : label.toLowerCase();
      els.search.value = state.query;
      render();
    });
    filters.append(chip);
  });
  wrap.append(filters);
  wrap.append(matchGrid(filterMatchGroup(filterMatches(state.matches)), true));
  return wrap;
}

function renderGroups() {
  const grid = div("groups-grid");
  const groups = groupLetters.filter(groupMatchesQuery);
  if (!groups.length) {
    grid.innerHTML = `<div class="empty">No groups or teams match the current search.</div>`;
    return grid;
  }
  groups.forEach((group) => grid.append(groupTable(group)));
  return grid;
}

function renderStats() {
  const config = statsConfig()[state.statsTab] || statsConfig().playerGoals;
  const items = filterStatItems(config.items());
  const wrap = div("stats-view");
  const tabs = div("stats-tabs");
  statsTabs.forEach((tab) => {
    const button = document.createElement("button");
    button.className = `stats-tab ${tab.id === state.statsTab ? "active" : ""}`;
    button.type = "button";
    button.innerHTML = `${statsTabIcon(tab)}<span>${tab.label}</span>`;
    button.addEventListener("click", () => {
      state.statsTab = tab.id;
      render();
    });
    tabs.append(button);
  });

  const board = div("stats-board");
  board.innerHTML = `
    <div class="stats-board-head">
      <strong>${escapeHtml(config.title)}</strong>
      <span>Top ${items.length}</span>
    </div>
    ${statsRows(items, config)}
  `;
  wrap.append(tabs, board);
  return wrap;
}

function renderBracket() {
  const wrap = div("bracket-page");
  const knockout = state.matches.filter((match) => !match.group && matchMatchesQuery(match));
  const byStage = groupBy(knockout, (match) => match.stage || "Knockout");
  const board = div("bracket-board");
  stageOrder.forEach((stage) => {
    const column = div("bracket-column");
    column.dataset.stage = stageClass(stage);
    const matches = (byStage[stage] || []).sort((a, b) => bracketSortKey(stage, a) - bracketSortKey(stage, b));
    const fallback = window.SEED_DATA.knockout.find(([round]) => round === stage);
    column.innerHTML = `<div class="bracket-column-head"><strong>${stage}</strong><span>${fallback?.[1] || ""}</span></div>`;
    if (matches.length) {
      matches.forEach((match, index) => column.append(bracketMatchCard(match, stage, index)));
    } else {
      const placeholder = div("bracket-placeholder");
      placeholder.innerHTML = `<span>${state.query ? "No matching matches" : fallback?.[2] || "Awaiting qualifiers"}</span>`;
      column.append(placeholder);
    }
    board.append(column);
  });
  wrap.append(board);
  const thirdPlace = (byStage["Third place"] || []).sort((a, b) => new Date(a.date) - new Date(b.date));
  if (thirdPlace.length) {
    const placement = div("placement-match");
    placement.append(sectionTitle("Third Place"));
    thirdPlace.forEach((match) => placement.append(matchCard(match, false)));
    wrap.append(placement);
  }
  wrap.append(bracketLegend());
  return wrap;
}

function bracketMatchCard(match, stage, index) {
  const card = div(`bracket-match ${match.completed ? "is-final" : ""} ${match.statusState === "in" ? "is-live" : ""}`);
  const matchNumber = officialMatchNumber(match);
  card.tabIndex = 0;
  card.innerHTML = `
    <div class="bracket-match-meta"><span>${matchNumber ? `Match ${matchNumber}` : formatMatchDate(match.date)}</span><strong>${escapeHtml(match.status)}</strong></div>
    ${bracketTeam(match.home, match.homeLogo, match.homeScore, isWinner(match, "home"), match.homeAbbr)}
    ${bracketTeam(match.away, match.awayLogo, match.awayScore, isWinner(match, "away"), match.awayAbbr)}
  `;
  card.addEventListener("click", () => openMatch(match));
  card.addEventListener("keydown", (event) => { if (event.key === "Enter") openMatch(match); });
  return card;
}

function bracketTeam(name, logo, score, winner, abbr = "") {
  return `
    <div class="bracket-team ${winner ? "winner" : ""} ${isFavoriteTeam(name) ? "favorite-team" : ""}">
      ${teamBadge(name, logo, abbr)}
      <span>${escapeHtml(bracketSlotLabel(name))}</span>
      <strong>${Number.isFinite(score) ? score : "-"}</strong>
    </div>
  `;
}

function bracketLegend() {
  const legend = div("bracket-legend");
  legend.innerHTML = `
    <span><i class="legend-dot live"></i>Live</span>
    <span><i class="legend-dot final"></i>Completed</span>
    <span><i class="legend-dot winner"></i>Advancing</span>
  `;
  return legend;
}

function matchGrid(matches, showDetails) {
  const grid = div("match-grid");
  if (!matches.length) {
    grid.innerHTML = `<div class="empty">No matches match the current search.</div>`;
    return grid;
  }
  matches.forEach((match) => grid.append(matchCard(match, showDetails)));
  return grid;
}

function matchCard(match, showDetails) {
  const card = div(`match-card ${match.statusState === "in" ? "is-live" : ""}`);
  card.tabIndex = 0;
  const scoring = match.goals.map(goalScoringText).join(", ");
  const badges = matchImportanceBadges(match);
  card.innerHTML = `
    <div class="match-meta">
      <span>${escapeHtml(match.stage)}${match.group ? ` / Group ${match.group}` : ""}</span>
      <strong>${escapeHtml(match.status)}</strong>
    </div>
    ${badges.length ? `<div class="match-badges">${badges.map((badge) => `<span class="${badgeClass(badge)}">${escapeHtml(badge)}</span>`).join("")}</div>` : ""}
    <div class="teams">
      ${teamLine(match.home, match.homeLogo, match.homeScore, match.homeAbbr)}
      ${teamLine(match.away, match.awayLogo, match.awayScore, match.awayAbbr)}
    </div>
    <div class="match-footer">
      <span>${formatMatchDate(match.date)} / ${escapeHtml(match.time)}</span>
    </div>
    ${showDetails ? `<div class="quick-stats">
      <span>${match.goals.length} goals</span>
      <span>${match.cards.filter((card) => card.kind === "yellow").length} yellow</span>
      <span>${match.cards.filter((card) => card.kind === "red").length} red</span>
    </div>` : ""}
    ${scoring ? `<p class="scorers">${escapeHtml(scoring)}</p>` : ""}
  `;
  card.addEventListener("click", () => openMatch(match));
  card.addEventListener("keydown", (event) => { if (event.key === "Enter") openMatch(match); });
  return card;
}

function teamLine(name, logo, score, abbr = "") {
  return `
    <div class="team-line ${isFavoriteTeam(name) ? "favorite-team" : ""}">
      ${teamBadge(name, logo, abbr)}
      <strong>${escapeHtml(name)}</strong>
      <span class="team-score">${Number.isFinite(score) ? score : "-"}</span>
    </div>
  `;
}

function goalScoringText(goal) {
  return `${goal.minute} ${goal.athlete || goal.team}${goal.ownGoal ? " (OG)" : ""}`;
}

function badgeClass(label) {
  return `match-badge badge-${String(label).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function groupTable(group) {
  const card = div("group-card");
  const rows = (state.standings[group] || state.groups[group].map(emptyStanding)).map((row, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${teamCell(row)}</td>
      <td>${row.played}</td>
      <td>${row.wins}</td>
      <td>${row.draws}</td>
      <td>${row.losses}</td>
      <td>${row.gf}</td>
      <td>${row.ga}</td>
      <td>${row.gd}</td>
      <td>${row.pts}</td>
    </tr>
  `).join("");
  card.innerHTML = `
    <div class="group-head"><strong>Group ${group}</strong><span>${groupChips(state.groups[group] || [])}</span></div>
    <table><thead><tr><th></th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr></thead><tbody>${rows}</tbody></table>
  `;
  return card;
}

function tournamentPulse() {
  const metrics = tournamentMetrics();
  const favorite = favoriteTeamPanel();
  const panel = div(`pulse-panel ${favorite ? "" : "single-panel"}`);
  panel.innerHTML = `
    ${favorite || ""}
    <article class="group-leaders-card">
      <span>Group leaders</span>
      ${leaderList(metrics.groupLeaders, 12)}
    </article>
  `;
  return panel;
}

function favoriteTeamPanel() {
  if (!state.favoriteTeam) return "";
  const matches = favoriteTeamMatches();
  const live = matches.find((match) => match.statusState === "in");
  const next = matches.find((match) => !match.completed && match.statusState !== "in");
  const latest = matches.filter((match) => match.completed).at(-1);
  const feature = live || next || latest;
  const standing = favoriteTeamStanding();
  const scorer = favoriteTeamTopScorer();
  const cardWatch = favoriteTeamCardWatch();
  const record = standing ? `${standing.wins}-${standing.draws}-${standing.losses}` : "0-0-0";
  const remaining = matches.filter((match) => !match.completed).length;
  const latestText = latest ? `${latest.home} ${scoreText(latest)} ${latest.away}` : "No result yet";
  return `
    <article class="favorite-team-card">
      <span>Following</span>
      <div class="favorite-team-main">
        <div class="favorite-team-head">
          ${teamBadge(state.favoriteTeam, "", "", "w160")}
          <strong>${escapeHtml(state.favoriteTeam)}</strong>
        </div>
        <div class="favorite-team-stat-grid">
          <p class="record-stat"><b>${escapeHtml(record)}</b><small>Record</small></p>
          <p><b>${standing?.pts ?? 0}</b><small>Pts</small></p>
          <p><b>${standing?.gf ?? 0}</b><small>GF</small></p>
          <p><b>${standing?.ga ?? 0}</b><small>GA</small></p>
        </div>
      </div>
      <div class="favorite-team-details">
        <p><b>${feature ? favoriteMatchLabel(feature) : "Schedule pending"}</b><small>${feature ? favoriteMatchDetail(feature) : "Waiting for match data"}</small></p>
        <p><b>${standing ? `Group ${standing.group}` : "Group"}</b><small>${standing ? `${standing.played} played / GD ${standing.gd > 0 ? `+${standing.gd}` : standing.gd}` : "Not available yet"}</small></p>
        <p class="wide-detail"><b>Latest</b><small>${escapeHtml(latestText)}</small></p>
        <p><b>Remaining</b><small>${remaining} match${remaining === 1 ? "" : "es"}</small></p>
        <p class="wide-detail"><b>Top scorer</b><small>${scorer ? `${escapeHtml(scorer.name)}<span>${escapeHtml(`${scorer.goals} goal${scorer.goals === 1 ? "" : "s"}`)}</span>` : "No goals yet"}</small></p>
        <p><b>Card watch</b><small>${escapeHtml(cardWatch ? `${cardWatch.name} / ${cardWatch.detail}` : "No cards yet")}</small></p>
      </div>
    </article>
  `;
}

function leaderList(items, limit = 4) {
  if (!items.length) return `<div class="empty small">Waiting for match data.</div>`;
  return `<ol class="leader-list">${items.slice(0, limit).map((item) => `
    <li><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.detail)}</span></li>
  `).join("")}</ol>`;
}

function statsConfig() {
  return {
    playerGoals: { title: "Player Goals Leaders", valueLabel: "player goals", items: rankedScorers },
    teamGoals: { title: "Team Goals Leaders", valueLabel: "team goals", items: rankedTeamGoals },
    assists: { title: "Assists Leaders", valueLabel: "assists", items: rankedAssists },
    yellows: { title: "Yellow Card Leaders", valueLabel: "yellow cards", items: () => rankedCardsByKind("yellow") },
    reds: { title: "Red Card Leaders", valueLabel: "red cards", items: () => rankedCardsByKind("red") },
    teams: { title: "Team Leaders", valueLabel: "points", items: rankedTeams }
  };
}

function statsTabIcon(tab) {
  if (tab.icon) return `<img src="assets/${escapeHtml(tab.icon)}" alt="">`;
  return `<i>${escapeHtml(tab.iconText || tab.label[0])}</i>`;
}

function statsRows(items, config) {
  if (!items.length) {
    const message = state.query ? "No stats match the current search." : `Waiting for ${escapeHtml(config.valueLabel)} data.`;
    return `<div class="empty small">${message}</div>`;
  }
  return `<ol class="stats-list">${items.map((item, index) => `
    <li>
      <span class="stats-rank">${index + 1}</span>
      <strong>${escapeHtml(item.name)}</strong>
      <small>${escapeHtml(item.team || item.meta || "")}</small>
      <b>${escapeHtml(item.value)}</b>
    </li>
  `).join("")}</ol>`;
}

function teamCell(row) {
  return `<span class="table-team">${teamBadge(row.team, row.logo)}${escapeHtml(row.team)}</span>`;
}

function renderMatchDialog(match, summary = null) {
  const stats = summary?.stats && Object.keys(summary.stats).length ? summary.stats : match.stats;
  const timeline = summary?.plays?.length ? summary.plays : match.details;
  const meaningfulTimeline = timeline.filter(isTimelineEvent).sort(sortEventsByMinute).slice(-80);
  const keyEvents = match.goals.concat(match.cards).sort(sortEventsByMinute);
  const officials = summary?.officials?.length ? summary.officials.join(", ") : "TBD";
  const espnLink = match.links.Summary || match.links.Report || match.links.Statistics || state.sourceUrl;

  els.dialogBody.innerHTML = `
    <div class="dialog-header">
      <div>
        <p class="eyebrow">${escapeHtml(match.stage)}${match.group ? ` / Group ${match.group}` : ""}</p>
        <h2>${escapeHtml(match.home)} ${scoreText(match)} ${escapeHtml(match.away)} <span class="match-clock">${escapeHtml(matchHeaderStatus(match))}</span></h2>
      </div>
      <div class="dialog-actions">
        <button class="dialog-link dialog-update" type="button">Update</button>
        <button class="dialog-link" type="button" data-url="${escapeHtml(espnLink)}">ESPN Match Page</button>
      </div>
    </div>
    <div class="detail-grid">
      ${detailTile("Kickoff", `${formatMatchDate(match.date)} / ${match.time}`)}
      ${detailTile("Location", matchLocation(match))}
      ${detailTile("Officials", officials)}
    </div>
    ${match.headline ? `<p class="headline">${escapeHtml(match.headline)}</p>` : ""}
    ${summary?.error ? `<p class="error-note">${escapeHtml(summary.error)}</p>` : ""}
    <div class="dialog-columns">
      <section>
        <h3>Match Stats</h3>
        ${statsTable(match, stats)}
      </section>
      <section>
        <h3>Key Events</h3>
        ${eventList(keyEvents)}
      </section>
    </div>
    <section>
      <h3>Timeline</h3>
      ${eventList(meaningfulTimeline, true)}
    </section>
  `;

  els.dialogBody.querySelector(".dialog-link[data-url]")?.addEventListener("click", (event) => {
    window.worldCup.openExternal(event.currentTarget.dataset.url);
  });
  els.dialogBody.querySelector(".dialog-update")?.addEventListener("click", (event) => {
    refreshSelectedMatch(event.currentTarget);
  });
}

function detailTile(label, value) {
  return `<article class="detail-tile"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value || "TBD"))}</strong></article>`;
}

function matchHeaderStatus(match) {
  if (match.statusState === "in") return match.status;
  if (match.completed) return "FT";
  return `${formatMatchDate(match.date)} ${match.time}`;
}

function matchLocation(match) {
  return [match.venue && match.venue !== "TBD" ? match.venue : "", match.city || "", match.country || ""]
    .filter(Boolean)
    .join(", ") || "TBD";
}

function statsTable(match, stats) {
  const left = stats[match.home] || {};
  const right = stats[match.away] || {};
  const keys = ["totalGoals", "totalShots", "shotsOnTarget", "possessionPct", "wonCorners", "foulsCommitted", "yellowCards", "redCards", "offsides", "saves", "totalPasses", "accuratePasses"];
  const rows = keys.map((key) => {
    const label = left[key]?.label || right[key]?.label || statLabels[key] || key;
    const [leftValue, rightValue] = statRowValues(match, left, right, key);
    return `<tr><td>${escapeHtml(leftValue)}</td><th>${escapeHtml(label)}</th><td>${escapeHtml(rightValue)}</td></tr>`;
  }).join("");
  return `<table class="stats-table"><thead><tr><th>${escapeHtml(match.homeAbbr || match.home)}</th><th></th><th>${escapeHtml(match.awayAbbr || match.away)}</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function statRowValues(match, left, right, key) {
  if (key === "totalGoals") {
    return [
      Number.isFinite(match.homeScore) ? String(match.homeScore) : left[key]?.value || "-",
      Number.isFinite(match.awayScore) ? String(match.awayScore) : right[key]?.value || "-"
    ];
  }
  return [left[key]?.value || "-", right[key]?.value || "-"];
}

function eventList(events, dense = false) {
  if (!events.length) return `<div class="empty small">No events reported yet.</div>`;
  return `<ol class="event-list ${dense ? "dense" : ""}">${events.map((event) => `
    <li class="${event.kind}">
      <span>${escapeHtml(event.minute || "")}</span>
      <div><strong>${escapeHtml(eventLabel(event))}</strong><small>${escapeHtml(eventDescription(event))}</small></div>
    </li>
  `).join("")}</ol>`;
}

function isTimelineEvent(event) {
  const text = `${event.type || ""} ${event.text || ""}`.toLowerCase();
  if (/delay|var check|injury break|cooling break/.test(text)) return false;
  return ["goal", "assist", "yellow", "red", "sub"].includes(event.kind)
    || /shot|foul|corner|penalty|offside|save|miss|blocked/i.test(text);
}

function sortEventsByMinute(a, b) {
  return eventMinuteValue(a) - eventMinuteValue(b);
}

function eventMinuteValue(event) {
  const raw = String(event.minute || "");
  const match = raw.match(/(\d+)(?:\D+(\d+))?/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  return Number(match[1]) * 100 + Number(match[2] || 0);
}

function eventLabel(event) {
  if (event.kind === "goal") return event.ownGoal ? `Own goal ${event.athlete || event.team}` : `Goal ${event.athlete || event.team}`;
  if (event.kind === "assist") return `Assist ${event.athlete || event.team}`;
  if (event.kind === "yellow") return `Yellow card ${event.athlete || event.team}`;
  if (event.kind === "red") return `Red card ${event.athlete || event.team}`;
  if (event.kind === "sub") return "Substitution";
  return event.type || event.team || "Event";
}

function eventDescription(event) {
  const label = eventLabel(event);
  const text = event.text || event.team || "";
  if (!text || text === event.type || text === label) return "";
  return text;
}

function createSeedMatches() {
  const pairings = [[0, 1, 0], [2, 3, 0], [0, 2, 1], [3, 1, 1], [3, 0, 2], [1, 2, 2]];
  let number = 1;
  return groupLetters.flatMap((group) => {
    const teams = window.SEED_DATA.groups[group];
    const dates = window.SEED_DATA.groupWindows[group];
    return pairings.map(([homeIndex, awayIndex, dateIndex]) => ({
      id: "",
      number: number++,
      group,
      stage: "Group stage",
      home: teams[homeIndex],
      away: teams[awayIndex],
      homeScore: null,
      awayScore: null,
      status: "Scheduled",
      statusState: "pre",
      completed: false,
      date: `${dates[dateIndex]}T12:00:00Z`,
      time: "TBD",
      venue: "TBD",
      city: "",
      country: "",
      broadcasts: [],
      stats: {},
      details: [],
      goals: [],
      cards: [],
      links: {},
      source: "Bundled fallback"
    }));
  });
}

function tournamentMetrics() {
  const scorers = rankedScorers();
  const cardLeaders = rankedCards();
  const groupLeaders = rankedGroupLeaders();
  const next = upcomingMatches()[0];
  const latest = recentResults()[0];
  return {
    scorers,
    cardLeaders,
    groupLeaders,
    leadingScorer: scorers[0] || { name: "No goals yet", detail: "waiting for kickoff" },
    nextMatch: next
      ? { value: `${next.homeAbbr || codeForTeam(next.home)} vs ${next.awayAbbr || codeForTeam(next.away)}`, detail: `${formatMatchDate(next.date)} / ${next.time}`, match: next }
      : { value: "No upcoming match", detail: "schedule complete", match: null },
    latestResult: latest
      ? { value: `${latest.homeAbbr || codeForTeam(latest.home)} ${safeScore(latest.homeScore)}-${safeScore(latest.awayScore)} ${latest.awayAbbr || codeForTeam(latest.away)}`, detail: `${formatMatchDate(latest.date)} / ${latest.status}`, match: latest }
      : { value: "No final yet", detail: "waiting for results", match: null }
  };
}

function allTeams() {
  return [...new Set([
    ...groupLetters.flatMap((group) => state.groups[group] || []),
    ...state.matches.flatMap((match) => [match.home, match.away])
  ].filter((team) => team && !isPlaceholderTeam(team)))]
    .sort((a, b) => a.localeCompare(b));
}

function isFavoriteTeam(team) {
  return Boolean(state.favoriteTeam && team === state.favoriteTeam);
}

function isPlaceholderTeam(team) {
  return /Group [A-L]\s+(Winner|2nd Place)|Third Place Group|3rd Group|Runner-up|Round of|Winner Match|Match \d+|Winner|Loser|Semifinal|Quarterfinal/i
    .test(String(team || ""));
}

function favoriteTeamMatches() {
  if (!state.favoriteTeam) return [];
  return state.matches
    .filter((match) => match.home === state.favoriteTeam || match.away === state.favoriteTeam)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function favoriteTeamStanding() {
  if (!state.favoriteTeam) return null;
  for (const group of groupLetters) {
    const row = (state.standings[group] || []).find((item) => item.team === state.favoriteTeam);
    if (row) return { ...row, group };
  }
  return null;
}

function favoriteMatchLabel(match) {
  if (match.statusState === "in") return "Live now";
  if (match.completed) return "Latest result";
  return "Next match";
}

function favoriteMatchDetail(match) {
  const opponent = match.home === state.favoriteTeam ? match.away : match.home;
  const score = match.completed || match.statusState === "in" ? ` / ${scoreText(match)}` : "";
  const kickoff = match.time && match.time !== "TBD"
    ? `${formatMatchDate(match.date)} ${match.time}`
    : formatMatchDate(match.date);
  return `
    <span class="favorite-opponent">${escapeHtml(opponent)}${escapeHtml(score)}${teamBadge(opponent)}</span>
    <span>${escapeHtml(kickoff)}</span>
  `;
}

function favoriteTeamTopScorer() {
  if (!state.favoriteTeam) return null;
  const totals = new Map();
  state.matches.forEach((match) => {
    match.goals.filter((goal) => goal.team === state.favoriteTeam && !goal.ownGoal).forEach((goal) => {
      const name = goal.athlete || "Unknown scorer";
      totals.set(name, (totals.get(name) || 0) + 1);
    });
  });
  const [name, goals] = [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] || [];
  return name ? { name, goals: `${goals} goal${goals === 1 ? "" : "s"}` } : null;
}

function favoriteTeamCardWatch() {
  if (!state.favoriteTeam) return null;
  const totals = new Map();
  state.matches.forEach((match) => {
    match.cards.filter((card) => card.team === state.favoriteTeam).forEach((card) => {
      const name = card.athlete || "Unknown";
      const entry = totals.get(name) || { name, yellow: 0, red: 0 };
      if (card.kind === "yellow") entry.yellow += 1;
      if (card.kind === "red") entry.red += 1;
      totals.set(name, entry);
    });
  });
  return [...totals.values()]
    .sort((a, b) => (b.red * 2 + b.yellow) - (a.red * 2 + a.yellow) || a.name.localeCompare(b.name))
    .map((item) => ({ ...item, detail: `${item.yellow}Y / ${item.red}R` }))[0] || null;
}

function matchImportanceBadges(match) {
  const badges = [];
  if (match.statusState === "in") badges.push("Live");
  if (match.completed) badges.push("Final");
  if (match.statusState === "pre") badges.push("Upcoming");
  if (!match.group || match.completed) return badges;
  [match.home, match.away].forEach((team) => {
    const row = state.standings[match.group]?.find((item) => item.team === team);
    if (!row || row.played < 1) return;
    if (row.pts >= 4) badges.push(`${codeForTeam(team)} can clinch`);
    if (row.pts <= 1 && row.played >= 2) badges.push(`${codeForTeam(team)} must win`);
  });
  return [...new Set(badges)].slice(0, 3);
}

function maybeNotifyMatchEvents(matches, previousMatches = new Map()) {
  if (!notificationsReady) {
    baselineExistingNotificationEvents(matches);
    notificationsReady = true;
  }
  if (!Object.values(state.alerts).some(Boolean)) return;
  matches.forEach((match) => {
    const title = `${match.home} vs ${match.away}`;
    const previous = previousMatches.get(match.id);
    const justWentLive = match.statusState === "in" && previous?.statusState !== "in";
    notifyOnce(state.alerts.kickoff && justWentLive, `kickoff:${match.id}`, "Match is live", title);
    notifyOnce(state.alerts.final && match.completed, `final:${match.id}`, "Final score", `${match.home} ${scoreText(match)} ${match.away}`);
    match.goals.forEach((goal, index) => {
      notifyOnce(state.alerts.goals, `goal:${match.id}:${goal.minute}:${goal.athlete || goal.team || index}`, `Goal ${goal.team || ""}`.trim(), `${goal.minute || ""} ${goal.athlete || title}`.trim());
    });
    match.cards.filter((card) => card.kind === "red").forEach((card, index) => {
      notifyOnce(state.alerts.red, `red:${match.id}:${card.minute}:${card.athlete || card.team || index}`, `Red card ${card.team || ""}`.trim(), `${card.minute || ""} ${card.athlete || title}`.trim());
    });
  });
}

function baselineExistingNotificationEvents(matches) {
  matches.forEach((match) => {
    if (match.completed) rememberNotification(`final:${match.id}`);
    match.goals.forEach((goal, index) => {
      rememberNotification(`goal:${match.id}:${goal.minute}:${goal.athlete || goal.team || index}`);
    });
    match.cards.filter((card) => card.kind === "red").forEach((card, index) => {
      rememberNotification(`red:${match.id}:${card.minute}:${card.athlete || card.team || index}`);
    });
  });
}

function notifyOnce(shouldNotify, key, title, body) {
  if (!shouldNotify || notifiedEvents.has(key)) return;
  rememberNotification(key);
  showLocalNotification(title, body);
}

function rankedScorers() {
  const totals = new Map();
  state.matches.forEach((match) => {
    match.goals.filter((goal) => !goal.ownGoal).forEach((goal) => {
      const name = goal.athlete || "Unknown scorer";
      const entry = totals.get(name) || { name, goals: 0, teams: new Set() };
      entry.goals += 1;
      if (goal.team) entry.teams.add(goal.team);
      totals.set(name, entry);
    });
  });
  return [...totals.values()]
    .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name))
    .map((item) => ({
      name: item.name,
      value: String(item.goals),
      team: [...item.teams][0] || "",
      detail: `${item.goals} goal${item.goals === 1 ? "" : "s"}${item.teams.size ? ` / ${[...item.teams][0]}` : ""}`
    }));
}

function rankedTeamGoals() {
  const totals = new Map();
  state.matches.forEach((match) => {
    if (match.goals.length) {
      match.goals.forEach((goal) => {
        if (!goal.team) return;
        totals.set(goal.team, (totals.get(goal.team) || 0) + 1);
      });
      return;
    }
    if (match.completed || match.statusState === "in") {
      if (Number.isFinite(match.homeScore)) totals.set(match.home, (totals.get(match.home) || 0) + match.homeScore);
      if (Number.isFinite(match.awayScore)) totals.set(match.away, (totals.get(match.away) || 0) + match.awayScore);
    }
  });
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, goals]) => ({
      name,
      value: String(goals),
      team: name,
      detail: `${goals} goal${goals === 1 ? "" : "s"}`
    }));
}

function rankedAssists() {
  const totals = new Map();
  state.matches.forEach((match) => {
    match.goals.filter((goal) => !goal.ownGoal).forEach((goal) => {
      if (goal.assist) addPlayerTotal(totals, goal.assist, goal.team, "assists");
    });
  });
  return [...totals.values()]
    .sort((a, b) => b.assists - a.assists || a.name.localeCompare(b.name))
    .map((item) => ({
      name: item.name,
      value: String(item.assists),
      team: [...item.teams][0] || "",
      detail: `${item.assists} assist${item.assists === 1 ? "" : "s"}${item.teams.size ? ` / ${[...item.teams][0]}` : ""}`
    }));
}

function extractAssistName(text) {
  const match = String(text || "").match(/Assisted by ([^.]+?)(?: with | following |\.|$)/i);
  return match ? match[1].trim() : "";
}

function addPlayerTotal(totals, name, team, key) {
  const entry = totals.get(name) || { name, teams: new Set(), [key]: 0 };
  entry[key] += 1;
  if (team) entry.teams.add(team);
  totals.set(name, entry);
}

function rankedCards() {
  const totals = new Map();
  state.matches.forEach((match) => {
    match.cards.forEach((card) => {
      const name = card.athlete || card.team || "Unknown";
      const entry = totals.get(name) || { name, yellow: 0, red: 0, team: card.team || "" };
      if (card.kind === "red") entry.red += 1;
      if (card.kind === "yellow") entry.yellow += 1;
      totals.set(name, entry);
    });
  });
  return [...totals.values()]
    .sort((a, b) => (b.red * 2 + b.yellow) - (a.red * 2 + a.yellow) || a.name.localeCompare(b.name))
    .map((item) => ({
      name: item.name,
      value: `${item.yellow + item.red}`,
      team: item.team,
      detail: `${item.yellow}Y / ${item.red}R${item.team ? ` / ${item.team}` : ""}`
    }));
}

function rankedCardsByKind(kind) {
  const totals = new Map();
  state.matches.forEach((match) => {
    match.cards.filter((card) => card.kind === kind).forEach((card) => {
      const name = card.athlete || card.team || "Unknown";
      const entry = totals.get(name) || { name, count: 0, team: card.team || "" };
      entry.count += 1;
      if (card.team) entry.team = card.team;
      totals.set(name, entry);
    });
  });
  return [...totals.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .map((item) => ({
      name: item.name,
      value: String(item.count),
      team: item.team,
      detail: `${item.count} ${kind === "yellow" ? "yellow" : "red"} card${item.count === 1 ? "" : "s"}${item.team ? ` / ${item.team}` : ""}`
    }));
}

function rankedTeams() {
  return groupLetters.flatMap((group) => (state.standings[group] || []).map((row) => ({
    name: row.team,
    value: String(row.pts),
    team: `Group ${group} / GD ${row.gd > 0 ? `+${row.gd}` : row.gd}`,
    detail: `${row.pts} pts / GD ${row.gd > 0 ? `+${row.gd}` : row.gd}`
  }))).sort((a, b) => Number(b.value) - Number(a.value) || a.name.localeCompare(b.name));
}

function rankedTeamStat(key, label) {
  const totals = new Map();
  state.matches.forEach((match) => {
    [match.home, match.away].forEach((team) => {
      const raw = match.stats[team]?.[key]?.value;
      const value = Number.parseFloat(String(raw ?? "").replace("%", ""));
      if (!Number.isFinite(value)) return;
      totals.set(team, (totals.get(team) || 0) + value);
    });
  });
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value: String(value), detail: `${Math.round(value)} ${label}` }));
}

function rankedGroupLeaders() {
  return groupLetters.map((group) => {
    const row = state.standings[group]?.[0];
    if (!row) return null;
    return {
      name: `Group ${group}: ${row.team}`,
      value: String(row.pts),
      detail: `${row.pts} pts / GD ${row.gd > 0 ? `+${row.gd}` : row.gd}`
    };
  }).filter(Boolean);
}

function recalculateStandings() {
  state.standings = {};
  for (const group of groupLetters) {
    const teams = new Map((state.groups[group] || []).map((team) => [team, emptyStanding(team)]));
    state.matches.filter((match) => match.group === group && Number.isFinite(match.homeScore) && Number.isFinite(match.awayScore)).forEach((match) => {
      if (!teams.has(match.home)) teams.set(match.home, emptyStanding(match.home, match.homeLogo));
      if (!teams.has(match.away)) teams.set(match.away, emptyStanding(match.away, match.awayLogo));
      const home = teams.get(match.home);
      const away = teams.get(match.away);
      home.logo = match.homeLogo || home.logo;
      away.logo = match.awayLogo || away.logo;
      home.played += 1; away.played += 1;
      home.gf += match.homeScore; home.ga += match.awayScore;
      away.gf += match.awayScore; away.ga += match.homeScore;
      home.gd = home.gf - home.ga; away.gd = away.gf - away.ga;
      if (match.homeScore > match.awayScore) { home.wins += 1; away.losses += 1; home.pts += 3; }
      else if (match.homeScore < match.awayScore) { away.wins += 1; home.losses += 1; away.pts += 3; }
      else { home.draws += 1; away.draws += 1; home.pts += 1; away.pts += 1; }
    });
    state.standings[group] = [...teams.values()].sort(sortTable);
  }
}

function todayMatches() {
  const today = new Date().toLocaleDateString("en-CA");
  return state.matches.filter((match) => localDate(match.date) === today);
}

function upcomingMatches() {
  const now = Date.now();
  return state.matches.filter((match) => !match.completed && new Date(match.date).getTime() >= now)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function recentResults() {
  return state.matches.filter((match) => match.completed)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function filterMatches(matches) {
  if (!state.query) return matches;
  const statusAlias = {
    live: (match) => match.statusState === "in",
    finished: (match) => match.completed,
    upcoming: (match) => match.statusState === "pre"
  };
  if (statusAlias[state.query]) return matches.filter(statusAlias[state.query]);
  return matches.filter(matchMatchesQuery);
}

function filterMatchGroup(matches) {
  if (!state.matchGroupFilter) return matches;
  return matches.filter((match) => match.group === state.matchGroupFilter);
}

function matchMatchesQuery(match) {
  if (!state.query) return true;
  const matchNumber = officialMatchNumber(match);
  return searchableText([
    match.home,
    match.away,
    match.homeAbbr,
    match.awayAbbr,
    match.group,
    match.group ? `Group ${match.group}` : "",
    match.stage,
    match.status,
    match.venue,
    match.city,
    match.country,
    match.date ? formatMatchDate(match.date) : "",
    match.time,
    matchNumber ? `Match ${matchNumber}` : "",
    scoreText(match),
    ...match.goals.map((goal) => `${goal.athlete || ""} ${goal.team || ""} goal ${goal.minute || ""}`),
    ...match.cards.map((card) => `${card.athlete || ""} ${card.team || ""} ${card.kind || ""} card ${card.minute || ""}`)
  ]).includes(state.query);
}

function groupMatchesQuery(group) {
  if (!state.query) return true;
  return searchableText([
    group,
    `Group ${group}`,
    ...(state.groups[group] || []),
    ...(state.standings[group] || []).map((row) => row.team)
  ]).includes(state.query);
}

function filterStatItems(items) {
  if (!state.query) return items;
  return items.filter((item) => searchableText([
    item.name,
    item.team,
    item.meta,
    item.detail,
    item.value
  ]).includes(state.query));
}

function searchableText(values) {
  return values.filter(Boolean).join(" ").toLowerCase();
}

function setLiveStatus(status, detail) {
  els.liveStatus.textContent = status;
  els.liveDetail.textContent = detail;
  els.compactLiveStatus.textContent = status;
  els.compactLiveDetail.textContent = detail;
}

function summaryCard(label, value, detail, action = "") {
  const actionAttr = action ? ` data-summary-action="${escapeHtml(action)}"` : "";
  return `<article class="summary-card"${actionAttr}><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small></article>`;
}

function sectionTitle(text) {
  const title = document.createElement("h2");
  title.className = "section-title";
  title.textContent = text;
  return title;
}

function div(className) {
  const element = document.createElement("div");
  element.className = className;
  return element;
}

function emptyStanding(team, logo = "") {
  return { team, logo, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
}

function sortTable(a, b) {
  return b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team);
}

function scoreText(match) {
  return Number.isFinite(match.homeScore) && Number.isFinite(match.awayScore) ? `${match.homeScore} - ${match.awayScore}` : "vs";
}

function safeScore(score) {
  return Number.isFinite(score) ? score : 0;
}

function bracketSortKey(stage, match) {
  const matchNumber = officialMatchNumber(match);
  const visualOrder = bracketVisualOrder[stage] || [];
  const position = visualOrder.indexOf(matchNumber);
  if (position >= 0) return position;
  return 1000 + new Date(match.date).getTime();
}

function officialMatchNumber(match) {
  const tokens = [slotToken(match.home), slotToken(match.away)].filter(Boolean).sort(compareBracketTokens);
  return officialMatchByEntrants.get(tokens.join("|")) || 0;
}

function compareBracketTokens(a, b) {
  return bracketTokenValue(a) - bracketTokenValue(b);
}

function bracketTokenValue(token) {
  const winner = String(token).match(/^W(\d+)$/);
  if (winner) return Number(winner[1]);
  const groupSlot = String(token).match(/^([123])([A-L])/);
  if (groupSlot) return Number(groupSlot[1]) * 100 + groupSlot[2].charCodeAt(0);
  return 999;
}

function slotToken(name) {
  const value = String(name || "").trim();
  let match = value.match(/round of 32\s+(\d+)\s+winner/i);
  if (match) return `W${72 + Number(match[1])}`;
  match = value.match(/round of 16\s+(\d+)\s+winner/i);
  if (match) return `W${88 + Number(match[1])}`;
  match = value.match(/quarterfinal\s+(\d+)\s+winner/i);
  if (match) return `W${96 + Number(match[1])}`;
  match = value.match(/semifinal\s+(\d+)\s+winner/i);
  if (match) return `W${100 + Number(match[1])}`;
  match = value.match(/group\s+([A-L])\s+winner/i) || value.match(/winner\s+group\s+([A-L])/i);
  if (match) return `1${match[1].toUpperCase()}`;
  match = value.match(/group\s+([A-L])\s+2nd\s+place/i) || value.match(/runner-up\s+group\s+([A-L])/i);
  if (match) return `2${match[1].toUpperCase()}`;
  match = value.match(/third\s+place\s+group\s+([A-L/]+)/i) || value.match(/3rd\s+group\s+([A-L/]+)/i);
  if (match) return `3${match[1].toUpperCase().replace(/[^A-L]/g, "").split("").sort().join("")}`;
  return "";
}

function bracketSlotLabel(name) {
  const value = String(name || "");
  return value
    .replace(/Round of 32\s+(\d+)\s+Winner/i, (_all, number) => `Winner Match ${72 + Number(number)}`)
    .replace(/Round of 16\s+(\d+)\s+Winner/i, (_all, number) => `Winner Match ${88 + Number(number)}`)
    .replace(/Quarterfinal\s+(\d+)\s+Winner/i, (_all, number) => `Winner Match ${96 + Number(number)}`)
    .replace(/Semifinal\s+(\d+)\s+Winner/i, (_all, number) => `Winner Match ${100 + Number(number)}`);
}

function formatMatchDate(value) {
  if (!value) return "TBD";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

function formatKickoff(value) {
  if (!value) return "TBD";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function localDate(value) {
  return new Date(value).toLocaleDateString("en-CA");
}

function titleCase(value) {
  return String(value).replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function codeForTeam(team) {
  const value = String(team || "");
  let match = value.match(/round of 32\s+(\d+)\s+winner/i);
  if (match) return `M${72 + Number(match[1])}`;
  match = value.match(/round of 16\s+(\d+)\s+winner/i);
  if (match) return `M${88 + Number(match[1])}`;
  match = value.match(/quarterfinal\s+(\d+)\s+winner/i);
  if (match) return `QF${match[1]}`;
  match = value.match(/semifinal\s+(\d+)\s+(winner|loser)/i);
  if (match) return `SF${match[1]}`;
  return teamCodes[team] || String(team || "").slice(0, 3).toUpperCase();
}

function flagUrlForTeam(team, size = "w80") {
  const code = teamFlagCodes[team];
  return code ? `https://flagcdn.com/${size}/${code}.png` : "";
}

function teamBadge(name, logo = "", abbr = "", flagSize = "w80") {
  const flag = flagUrlForTeam(name, flagSize);
  if (flag) return `<img class="flag-img" src="${escapeHtml(flag)}" alt="">`;
  if (logo) return `<img src="${escapeHtml(logo)}" alt="">`;
  return `<span class="team-code">${escapeHtml(abbr || codeForTeam(name))}</span>`;
}

function groupChips(teams) {
  return teams.map((team) => `<em>${teamBadge(team)}${escapeHtml(team)}</em>`).join("");
}

function stageClass(stage) {
  return String(stage).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function normalizeStage(value) {
  const normalized = String(value || "").toLowerCase().replace(/[_-]/g, " ");
  if (normalized.includes("round of 32")) return "Round of 32";
  if (normalized.includes("rd of 16") || normalized.includes("round of 16")) return "Round of 16";
  if (normalized.includes("quarter")) return "Quarterfinals";
  if (normalized.includes("semi")) return "Semifinals";
  if (normalized.includes("3rd") || normalized.includes("third")) return "Third place";
  if (normalized.includes("final")) return "Final";
  return titleCase(value);
}

function isWinner(match, side) {
  if (!match.completed || !Number.isFinite(match.homeScore) || !Number.isFinite(match.awayScore)) return false;
  if (match.homeScore === match.awayScore) return false;
  return side === "home" ? match.homeScore > match.awayScore : match.awayScore > match.homeScore;
}

function groupBy(items, getKey) {
  return items.reduce((groups, item) => {
    const key = getKey(item);
    groups[key] = groups[key] || [];
    groups[key].push(item);
    return groups;
  }, {});
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}
