import { groupLetters, viewTitles } from "../utils/constants.js";
import { createSeedMatches } from "../services/espnClient.js";
import {
  codeForTeam,
  countLabel,
  emptyStanding,
  formatMatchDate,
  localDate,
  officialMatchNumber,
  safeScore,
  scoreText,
  searchableText,
  sortTable
} from "../utils/formatters.js";

const savedView = localStorage.getItem("lastView");
const initialView = Object.hasOwn(viewTitles, savedView) ? savedView : "today";

const initialState = {
  view: initialView,
  statsTab: "playerGoals",
  query: "",
  matchGroupFilter: "",
  matchStatusFilter: "all",
  favoriteTeam: localStorage.getItem("favoriteTeam") || "",
  compactMode: localStorage.getItem("compactMode") === "true",
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

let state = {
  ...initialState,
  standings: recalculateStandings(initialState)
};

const listeners = new Set();

export function getState() {
  return state;
}

export function updateState(payload = {}) {
  const next = { ...state, ...payload };
  if (payload.matches || payload.groups) {
    next.standings = recalculateStandings(next);
  }
  state = next;
  persistPreferences(payload);
  listeners.forEach((listener) => listener(state));
  return state;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function persistPreferences(payload) {
  if (Object.hasOwn(payload, "view")) localStorage.setItem("lastView", state.view);
  if (Object.hasOwn(payload, "favoriteTeam")) {
    if (state.favoriteTeam) localStorage.setItem("favoriteTeam", state.favoriteTeam);
    else localStorage.removeItem("favoriteTeam");
  }
  if (Object.hasOwn(payload, "compactMode")) localStorage.setItem("compactMode", String(state.compactMode));
}

export function recalculateStandings(appState) {
  const standings = {};
  for (const group of groupLetters) {
    const teams = new Map((appState.groups[group] || []).map((team) => [team, emptyStanding(team)]));
    appState.matches
      .filter((match) => match.group === group && Number.isFinite(match.homeScore) && Number.isFinite(match.awayScore))
      .forEach((match) => {
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
    standings[group] = [...teams.values()].sort(sortTable);
  }
  return standings;
}

export function tournamentMetrics(appState) {
  const scorers = rankedScorers(appState);
  const cardLeaders = rankedCards(appState);
  const groupLeaders = rankedGroupLeaders(appState);
  const next = upcomingMatches(appState)[0];
  const latest = recentResults(appState)[0];
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

export function todayMatches(appState) {
  const today = new Date().toLocaleDateString("en-CA");
  return appState.matches.filter((match) => localDate(match.date) === today);
}

export function upcomingMatches(appState) {
  const now = Date.now();
  return appState.matches.filter((match) => !match.completed && new Date(match.date).getTime() >= now)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

export function recentResults(appState) {
  return appState.matches.filter((match) => match.completed)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function allTeams(appState) {
  return [...new Set([
    ...groupLetters.flatMap((group) => appState.groups[group] || []),
    ...appState.matches.flatMap((match) => [match.home, match.away])
  ].filter((team) => team && !isPlaceholderTeam(team)))]
    .sort((a, b) => a.localeCompare(b));
}

export function isFavoriteTeam(appState, team) {
  return Boolean(appState.favoriteTeam && team === appState.favoriteTeam);
}

export function isPlaceholderTeam(team) {
  return /Group [A-L]\s+(Winner|2nd Place)|Third Place Group|3rd Group|Runner-up|Round of|Winner Match|Match \d+|Winner|Loser|Semifinal|Quarterfinal/i
    .test(String(team || ""));
}

export function favoriteTeamMatches(appState) {
  if (!appState.favoriteTeam) return [];
  return appState.matches
    .filter((match) => match.home === appState.favoriteTeam || match.away === appState.favoriteTeam)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

export function favoriteTeamStanding(appState) {
  if (!appState.favoriteTeam) return null;
  for (const group of groupLetters) {
    const row = (appState.standings[group] || []).find((item) => item.team === appState.favoriteTeam);
    if (row) return { ...row, group };
  }
  return null;
}

export function favoriteTeamGroupRank(appState) {
  const standing = favoriteTeamStanding(appState);
  if (!standing?.group) return null;
  const rows = appState.standings[standing.group] || [];
  const index = rows.findIndex((item) => item.team === appState.favoriteTeam);
  return index >= 0 ? { place: index + 1, total: rows.length } : null;
}

export function favoriteMatchLabel(match) {
  if (match.statusState === "in") return "Live now";
  if (match.completed) return "Latest result";
  return "Next match";
}

export function favoriteTeamTopScorer(appState) {
  if (!appState.favoriteTeam) return null;
  const totals = new Map();
  appState.matches.forEach((match) => {
    match.goals.filter((goal) => goal.team === appState.favoriteTeam && !goal.ownGoal).forEach((goal) => {
      const name = goal.athlete || "Unknown scorer";
      totals.set(name, (totals.get(name) || 0) + 1);
    });
  });
  const [name, goals] = [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] || [];
  return name ? { name, goals } : null;
}

export function favoriteTeamCardWatch(appState) {
  if (!appState.favoriteTeam) return null;
  const totals = new Map();
  appState.matches.forEach((match) => {
    match.cards.filter((card) => card.team === appState.favoriteTeam).forEach((card) => {
      const name = card.athlete || "Unknown";
      const entry = totals.get(name) || { name, yellow: 0, red: 0 };
      if (card.kind === "yellow") entry.yellow += 1;
      if (card.kind === "red") entry.red += 1;
      totals.set(name, entry);
    });
  });
  return [...totals.values()]
    .sort((a, b) => (b.red * 2 + b.yellow) - (a.red * 2 + a.yellow) || a.name.localeCompare(b.name))
    .map((item) => ({ ...item, detail: `${countLabel(item.yellow, "yellow")} / ${countLabel(item.red, "red")}` }))[0] || null;
}

export function matchImportanceBadges(appState, match) {
  const badges = [];
  if (match.statusState === "in") badges.push("Live");
  if (match.completed) badges.push("Final");
  if (match.statusState === "pre") badges.push("Upcoming");
  if (!match.group || match.completed) return badges;
  [match.home, match.away].forEach((team) => {
    const row = appState.standings[match.group]?.find((item) => item.team === team);
    if (!row || row.played < 1) return;
    if (row.pts >= 4) badges.push(`${codeForTeam(team)} can clinch`);
    if (row.pts <= 1 && row.played >= 2) badges.push(`${codeForTeam(team)} must win`);
  });
  return [...new Set(badges)].slice(0, 3);
}

export function rankedScorers(appState) {
  const totals = new Map();
  appState.matches.forEach((match) => {
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
      fullName: item.name,
      isPlayer: true,
      value: String(item.goals),
      team: [...item.teams][0] || "",
      detail: `${item.goals} goal${item.goals === 1 ? "" : "s"}${item.teams.size ? ` / ${[...item.teams][0]}` : ""}`
    }));
}

export function rankedTeamGoals(appState) {
  const totals = new Map();
  appState.matches.forEach((match) => {
    if (match.completed || match.statusState === "in") {
      if (Number.isFinite(match.homeScore)) totals.set(match.home, (totals.get(match.home) || 0) + match.homeScore);
      if (Number.isFinite(match.awayScore)) totals.set(match.away, (totals.get(match.away) || 0) + match.awayScore);
      return;
    }
    match.goals.forEach((goal) => {
      if (!goal.team) return;
      totals.set(goal.team, (totals.get(goal.team) || 0) + 1);
    });
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

export function rankedAssists(appState) {
  const totals = new Map();
  appState.matches.forEach((match) => {
    match.goals.filter((goal) => !goal.ownGoal).forEach((goal) => {
      if (goal.assist) addPlayerTotal(totals, goal.assist, goal.team, "assists");
    });
  });
  return [...totals.values()]
    .sort((a, b) => b.assists - a.assists || a.name.localeCompare(b.name))
    .map((item) => ({
      name: item.name,
      fullName: item.name,
      isPlayer: true,
      value: String(item.assists),
      team: [...item.teams][0] || "",
      detail: `${item.assists} assist${item.assists === 1 ? "" : "s"}${item.teams.size ? ` / ${[...item.teams][0]}` : ""}`
    }));
}

export function addPlayerTotal(totals, name, team, key) {
  const entry = totals.get(name) || { name, teams: new Set(), [key]: 0 };
  entry[key] += 1;
  if (team) entry.teams.add(team);
  totals.set(name, entry);
}

export function rankedCards(appState) {
  const totals = new Map();
  appState.matches.forEach((match) => {
    match.cards.forEach((card) => {
      const name = card.athlete || card.team || "Unknown";
      const entry = totals.get(name) || { name, yellow: 0, red: 0, team: card.team || "", isPlayer: Boolean(card.athlete) };
      if (card.kind === "red") entry.red += 1;
      if (card.kind === "yellow") entry.yellow += 1;
      entry.isPlayer = entry.isPlayer || Boolean(card.athlete);
      totals.set(name, entry);
    });
  });
  return [...totals.values()]
    .sort((a, b) => (b.red * 2 + b.yellow) - (a.red * 2 + a.yellow) || a.name.localeCompare(b.name))
    .map((item) => ({
      name: item.name,
      fullName: item.name,
      isPlayer: item.isPlayer,
      value: `${item.yellow + item.red}`,
      team: item.team,
      detail: `${item.yellow}Y / ${item.red}R${item.team ? ` / ${item.team}` : ""}`
    }));
}

export function rankedCardsByKind(appState, kind) {
  const totals = new Map();
  appState.matches.forEach((match) => {
    match.cards.filter((card) => card.kind === kind).forEach((card) => {
      const name = card.athlete || card.team || "Unknown";
      const entry = totals.get(name) || { name, count: 0, team: card.team || "", isPlayer: Boolean(card.athlete) };
      entry.count += 1;
      if (card.team) entry.team = card.team;
      entry.isPlayer = entry.isPlayer || Boolean(card.athlete);
      totals.set(name, entry);
    });
  });
  return [...totals.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .map((item) => ({
      name: item.name,
      fullName: item.name,
      isPlayer: item.isPlayer,
      value: String(item.count),
      team: item.team,
      detail: `${item.count} ${kind === "yellow" ? "yellow" : "red"} card${item.count === 1 ? "" : "s"}${item.team ? ` / ${item.team}` : ""}`
    }));
}

export function rankedTeams(appState) {
  return groupLetters.flatMap((group) => (appState.standings[group] || []).map((row) => ({
    name: row.team,
    value: String(row.pts),
    team: `Group ${group} / GD ${row.gd > 0 ? `+${row.gd}` : row.gd}`,
    detail: `${row.pts} pts / GD ${row.gd > 0 ? `+${row.gd}` : row.gd}`
  }))).sort((a, b) => Number(b.value) - Number(a.value) || a.name.localeCompare(b.name));
}

export function rankedTeamStat(appState, key, label) {
  const totals = new Map();
  appState.matches.forEach((match) => {
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

export function rankedGroupLeaders(appState) {
  return groupLetters.map((group) => {
    const row = appState.standings[group]?.[0];
    if (!row) return null;
    return {
      name: `Group ${group}: ${row.team}`,
      value: String(row.pts),
      detail: `${row.pts} pts / GD ${row.gd > 0 ? `+${row.gd}` : row.gd}`
    };
  }).filter(Boolean);
}

export function filterMatches(appState, matches, includeStatus = false) {
  const statusAlias = {
    live: (match) => match.statusState === "in",
    finished: (match) => match.completed,
    upcoming: (match) => match.statusState === "pre"
  };
  const statusFiltered = includeStatus && statusAlias[appState.matchStatusFilter]
    ? matches.filter(statusAlias[appState.matchStatusFilter])
    : matches;
  return appState.query ? statusFiltered.filter((match) => matchMatchesQuery(appState, match)) : statusFiltered;
}

export function filterMatchGroup(appState, matches) {
  if (!appState.matchGroupFilter) return matches;
  return matches.filter((match) => match.group === appState.matchGroupFilter);
}

export function sortMatchCenterMatches(appState, matches) {
  if (appState.matchStatusFilter !== "finished") return matches;
  return [...matches].sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function matchMatchesQuery(appState, match) {
  if (!appState.query) return true;
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
  ]).includes(appState.query);
}

export function groupMatchesQuery(appState, group) {
  if (!appState.query) return true;
  return searchableText([
    group,
    `Group ${group}`,
    ...(appState.groups[group] || []),
    ...(appState.standings[group] || []).map((row) => row.team)
  ]).includes(appState.query);
}

export function filterStatItems(appState, items) {
  if (!appState.query) return items;
  return items.filter((item) => searchableText([
    item.name,
    item.fullName,
    item.team,
    item.meta,
    item.detail,
    item.value
  ]).includes(appState.query));
}
