import {
  favoriteMatchLabel,
  favoriteTeamCardWatch,
  favoriteTeamGroupRank,
  favoriteTeamMatches,
  favoriteTeamStanding,
  favoriteTeamTopScorer,
  tournamentMetrics,
  upcomingMatches
} from "../store/appState.js";
import { uniqueEvents } from "../services/espnClient.js";
import {
  codeForTeam,
  countLabel,
  displayPlayerName,
  escapeHtml,
  eventLabel,
  formatMatchDate,
  isTimelineEvent,
  matchGoalTotal,
  scoreText,
  sortEventsByMinute,
  teamBadge
} from "../utils/formatters.js";

export function sidebarFeatureMatch(appState) {
  const liveMatches = appState.matches.filter((match) => match.statusState === "in");
  return liveMatches[0] || upcomingMatches(appState)[0] || null;
}

export function renderSidebarLiveMatch(appState) {
  const liveMatches = appState.matches.filter((match) => match.statusState === "in");
  const match = liveMatches[0] || upcomingMatches(appState)[0];
  if (!match) {
    return `
      <span class="sidebar-live-label">Live</span>
      <strong>No matches live</strong>
      <small>Schedule complete</small>
    `;
  }

  const isLive = match.statusState === "in";
  return `
    <span class="sidebar-live-label">${isLive ? "Live" : "Next"}</span>
    <strong>${escapeHtml(match.homeAbbr || codeForTeam(match.home))} ${scoreText(match)} ${escapeHtml(match.awayAbbr || codeForTeam(match.away))}</strong>
    <small>${escapeHtml(isLive ? match.status : `${formatMatchDate(match.date)} ${match.time}`)}${liveMatches.length > 1 ? ` / ${liveMatches.length} live` : ""}</small>
    ${isLive || match.completed ? sidebarLiveStats(match) : ""}
    ${isLive || match.completed ? sidebarLiveEvents(match) : ""}
  `;
}

export function sidebarLiveStats(match) {
  const yellow = match.cards.filter((card) => card.kind === "yellow").length || sidebarMatchStat(match, "yellowCards");
  const red = match.cards.filter((card) => card.kind === "red").length || sidebarMatchStat(match, "redCards");
  const shots = sidebarMatchStat(match, "totalShots");
  const items = [
    [`${matchGoalTotal(match)}`, "goals"],
    [`${yellow}`, "yellow"],
    [`${red}`, "red"]
  ];
  if (shots) items.push([String(shots), "shots"]);
  return `<div class="sidebar-live-stats">${items.map(([value, label]) => `
    <span><b>${escapeHtml(value)}</b>${escapeHtml(label)}</span>
  `).join("")}</div>`;
}

export function sidebarMatchStat(match, key) {
  return [match.home, match.away].reduce((total, team) => {
    const raw = match.stats[team]?.[key]?.value;
    const value = Number.parseFloat(String(raw ?? "").replace("%", ""));
    return total + (Number.isFinite(value) ? value : 0);
  }, 0);
}

export function sidebarLiveEvents(match) {
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

export function tournamentPulse(appState) {
  const metrics = tournamentMetrics(appState);
  const favorite = favoriteTeamPanel(appState);
  return `
    <div class="pulse-panel ${favorite ? "" : "single-panel"}">
      ${favorite || ""}
      <article class="group-leaders-card">
        <span>Group leaders</span>
        ${leaderList(metrics.groupLeaders, 12)}
      </article>
    </div>
  `;
}

export function favoriteTeamPanel(appState) {
  if (!appState.favoriteTeam) return "";
  const matches = favoriteTeamMatches(appState);
  const live = matches.find((match) => match.statusState === "in");
  const next = matches.find((match) => !match.completed && match.statusState !== "in");
  const latest = matches.filter((match) => match.completed).at(-1);
  const feature = live || next || latest;
  const standing = favoriteTeamStanding(appState);
  const scorer = favoriteTeamTopScorer(appState);
  const cardWatch = favoriteTeamCardWatch(appState);
  const record = standing ? `${standing.wins}-${standing.draws}-${standing.losses}` : "0-0-0";
  const remaining = matches.filter((match) => !match.completed).length;
  const latestText = latest ? `${latest.home} ${scoreText(latest)} ${latest.away}` : "No result yet";
  const rank = favoriteTeamGroupRank(appState);
  return `
    <article class="favorite-team-card"${feature?.id || feature?.number ? ` data-favorite-match-id="${escapeHtml(feature.id || feature.number)}"` : ""}>
      <span>Following</span>
      <div class="favorite-team-main">
        <div class="favorite-team-head">
          ${teamBadge(appState.favoriteTeam, "", "", "w160")}
          <strong>${escapeHtml(appState.favoriteTeam)}</strong>
        </div>
        <div class="favorite-team-stat-grid">
          <p class="record-stat"><b>${escapeHtml(record)}</b><small>Record</small></p>
          <p><b>${standing?.pts ?? 0}</b><small>Pts</small></p>
          <p><b>${standing?.gf ?? 0}</b><small>GF</small></p>
          <p><b>${standing?.ga ?? 0}</b><small>GA</small></p>
        </div>
      </div>
      <div class="favorite-team-details">
        <p><b>${feature ? favoriteMatchLabel(feature) : "Schedule pending"}</b><small>${feature ? favoriteMatchDetail(appState, feature) : "Waiting for match data"}</small></p>
        <p><b>${standing ? `Group ${standing.group}` : "Group"}</b><small>${standing ? `${standing.played} played / GD ${standing.gd > 0 ? `+${standing.gd}` : standing.gd}` : "Not available yet"}</small></p>
        <p class="wide-detail"><b>Latest</b><small>${escapeHtml(latestText)}</small></p>
        <p><b>Remaining</b><small>${remaining} match${remaining === 1 ? "" : "es"}</small></p>
        <p><b>Top scorer</b><small>${scorer ? `${escapeHtml(displayPlayerName(scorer.name))}<span>${escapeHtml(countLabel(scorer.goals, "goal"))}</span>` : "No goals yet"}</small></p>
        <p><b>Card watch</b><small>${cardWatch ? `${escapeHtml(displayPlayerName(cardWatch.name))}<span>${escapeHtml(cardWatch.detail)}</span>` : "No cards yet"}</small></p>
        <p><b>Group rank</b><small>${rank ? `#${rank.place} of ${rank.total}` : "Not ranked yet"}</small></p>
      </div>
    </article>
  `;
}

function favoriteMatchDetail(appState, match) {
  const opponent = match.home === appState.favoriteTeam ? match.away : match.home;
  const score = match.completed || match.statusState === "in" ? ` / ${scoreText(match)}` : "";
  const kickoff = match.time && match.time !== "TBD"
    ? `${formatMatchDate(match.date)} ${match.time}`
    : formatMatchDate(match.date);
  return `
    <span class="favorite-opponent">${escapeHtml(opponent)}${escapeHtml(score)}${teamBadge(opponent)}</span>
    <span>${escapeHtml(kickoff)}</span>
  `;
}

export function bindFavoritePanel(root, appState, onOpenMatch) {
  const card = root.querySelector(".favorite-team-card[data-favorite-match-id]");
  if (!card) return;
  const match = appState.matches.find((item) => String(item.id || item.number) === card.dataset.favoriteMatchId);
  if (!match) return;
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Open ${appState.favoriteTeam} match details`);
  card.addEventListener("click", () => onOpenMatch(match));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpenMatch(match);
    }
  });
}

export function leaderList(items, limit = 4) {
  if (!items.length) return `<div class="empty small">Waiting for match data.</div>`;
  return `<ol class="leader-list">${items.slice(0, limit).map((item) => `
    <li><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.detail)}</span></li>
  `).join("")}</ol>`;
}
