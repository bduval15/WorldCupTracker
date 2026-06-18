import {
  IDLE_REFRESH_MAX_MS,
  IDLE_REFRESH_MIN_MS,
  INITIAL_REFRESH_MAX_MS,
  INITIAL_REFRESH_MIN_MS,
  LIVE_REFRESH_MAX_MS,
  LIVE_REFRESH_MIN_MS,
  groupLetters,
  statLabels,
  statsTabs,
  viewTitles
} from "./utils/constants.js";
import {
  allTeams,
  filterMatchGroup,
  filterMatches,
  filterStatItems,
  getState,
  groupMatchesQuery,
  matchMatchesQuery,
  rankedAssists,
  rankedCardsByKind,
  rankedScorers,
  rankedTeamGoals,
  rankedTeams,
  recentResults,
  sortMatchCenterMatches,
  subscribe,
  todayMatches,
  tournamentMetrics,
  upcomingMatches,
  updateState
} from "./store/appState.js";
import { espnClient } from "./services/espnClient.js";
import { renderBracket } from "./components/Bracket.js";
import { matchGrid } from "./components/MatchCard.js";
import {
  bindFavoritePanel,
  renderSidebarLiveMatch,
  sidebarFeatureMatch,
  tournamentPulse
} from "./components/Sidebar.js";
import {
  applyCompactMode,
  applyFavoriteTheme,
  els,
  setLiveStatus,
  summaryCard,
  updateSearchUi
} from "./components/ui.js";
import {
  displayStatName,
  emptyStanding,
  escapeHtml,
  eventDescription,
  eventLabel,
  flagUrlForTeam,
  formatDateTime,
  formatMatchDate,
  groupChips,
  isTimelineEvent,
  scoreText,
  sortEventsByMinute,
  teamBadge
} from "./utils/formatters.js";

let refreshTimer = null;
let refreshInFlight = false;

subscribe(render);
initEventListeners();
syncFavoriteSelectOptions(getState());
applyCompactMode(getState().compactMode);
render(getState());
scheduleNextRefresh(randomMs(INITIAL_REFRESH_MIN_MS, INITIAL_REFRESH_MAX_MS));

function initEventListeners() {
  document.querySelectorAll(".nav-button[data-view]").forEach((button) => {
    button.addEventListener("click", () => updateState({ view: button.dataset.view }));
  });

  els.search.addEventListener("input", (event) => {
    updateState({ query: event.target.value.trim().toLowerCase() });
  });

  els.favoriteSelect.addEventListener("change", (event) => {
    updateState({ favoriteTeam: event.target.value });
  });

  els.compactButton.addEventListener("click", () => {
    updateState({ compactMode: !getState().compactMode });
  });

  els.compactNavButton.addEventListener("click", () => {
    updateState({ compactMode: !getState().compactMode });
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
}

function scheduleNextRefresh(delayMs = nextRefreshDelay()) {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => refreshLive(), delayMs);
}

function nextRefreshDelay() {
  const hasLive = getState().matches.some((match) => match.statusState === "in");
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
  setLiveStatus("Updating", "");
  try {
    const current = getState();
    const payload = await espnClient.fetchAndNormalizeLive({
      force: Boolean(options.force),
      previousMatches: current.matches
    });
    if (!payload.matches.length) throw new Error("ESPN returned no World Cup events.");

    updateState({
      matches: payload.matches,
      groups: { ...current.groups, ...payload.groups },
      source: payload.sourceName,
      sourceUrl: payload.sourceUrl,
      lastUpdated: payload.fetchedAt,
      liveError: null
    });
    setLiveStatus(payload.stale ? "Offline data" : "Live", payload.stale ? formatDateTime(payload.fetchedAt) : "");
  } catch (error) {
    updateState({ liveError: error.message });
    setLiveStatus("Offline data", error.message || "Sync unavailable");
  } finally {
    refreshInFlight = false;
    if (!document.hidden) scheduleNextRefresh();
  }
}

function render(appState) {
  els.title.textContent = viewTitles[appState.view];
  updateNavUi(appState);
  syncFavoriteSelectOptions(appState);
  updateFavoriteIdentity(appState);
  updateSearchUi(appState.view);
  applyCompactMode(appState.compactMode);
  renderSidebar(appState);
  renderSummary(appState);

  const renderers = {
    today: renderToday,
    matches: renderMatches,
    stats: renderStats,
    groups: renderGroups,
    bracket: renderBracketView
  };
  els.root.innerHTML = renderers[appState.view](appState);
  bindRootInteractions(appState);
  bindFavoritePanel(els.root, appState, openMatch);
}

function updateNavUi(appState) {
  document.querySelectorAll(".nav-button[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === appState.view);
  });
}

function renderSidebar(appState) {
  const match = sidebarFeatureMatch(appState);
  els.sidebarLiveMatch.innerHTML = renderSidebarLiveMatch(appState);
  if (!match) {
    els.sidebarLiveMatch.removeAttribute("tabindex");
    els.sidebarLiveMatch.onclick = null;
    els.sidebarLiveMatch.onkeydown = null;
    return;
  }
  els.sidebarLiveMatch.tabIndex = 0;
  els.sidebarLiveMatch.onclick = () => openMatch(match);
  els.sidebarLiveMatch.onkeydown = (event) => { if (event.key === "Enter") openMatch(match); };
}

function syncFavoriteSelectOptions(appState) {
  const teams = allTeams(appState);
  els.favoriteSelect.innerHTML = [
    `<option value="">Choose a team</option>`,
    ...teams.map((team) => `<option value="${escapeHtml(team)}">${escapeHtml(team)}</option>`)
  ].join("");
  els.favoriteSelect.value = teams.includes(appState.favoriteTeam) ? appState.favoriteTeam : "";
}

function updateFavoriteIdentity(appState) {
  const favorite = appState.favoriteTeam;
  const flag = favorite ? flagUrlForTeam(favorite, "w160") : "";
  const mark = els.brandMark.closest(".brand-mark");
  els.brandMark.src = flag || "assets/soccer-ball.svg";
  els.brandMark.classList.toggle("is-flag", Boolean(flag));
  mark?.classList.toggle("is-favorite", Boolean(flag));
  els.brandSubtitle.textContent = favorite || "2026 Matchday";
  els.favoriteSelect.value = favorite;
  applyFavoriteTheme(favorite);
}

function renderSummary(appState) {
  const metrics = tournamentMetrics(appState);
  els.summary.innerHTML = [
    summaryCard("Golden boot", displayStatName(metrics.leadingScorer), metrics.leadingScorer.detail),
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

function renderToday(appState) {
  const today = todayMatches(appState);
  const primaryMatches = filterMatches(appState, today.length ? today : upcomingMatches(appState).slice(0, 10));
  const latestResults = filterMatches(appState, recentResults(appState).slice(0, 6));
  return `
    <div class="stack">
      ${tournamentPulse(appState)}
      <h2 class="section-title">${today.length ? "Today's Matches" : "Next Matches"}</h2>
      ${matchGrid(primaryMatches, true, appState.favoriteTeam, appState.standings, { hasFilters: hasActiveFilters(appState) })}
      <h2 class="section-title">Latest Final Results</h2>
      ${matchGrid(latestResults, false, appState.favoriteTeam, appState.standings, { hasFilters: hasActiveFilters(appState) })}
    </div>
  `;
}

function renderMatches(appState) {
  const filters = `
    <div class="filter-row">
      <select class="group-filter" aria-label="Filter matches by group" data-action="group-filter">
        <option value="">All groups</option>
        ${groupLetters.map((group) => `<option value="${group}" ${appState.matchGroupFilter === group ? "selected" : ""}>Group ${group}</option>`).join("")}
      </select>
      ${["All", "Live", "Finished", "Upcoming"].map((label) => {
        const filter = label.toLowerCase();
        return `<button class="filter-chip ${appState.matchStatusFilter === filter ? "active" : ""}" type="button" aria-pressed="${appState.matchStatusFilter === filter}" data-status-filter="${filter}">${label}</button>`;
      }).join("")}
    </div>
  `;
  const matches = sortMatchCenterMatches(
    appState,
    filterMatchGroup(appState, filterMatches(appState, appState.matches, true))
  );
  return `<div class="match-center">${filters}${matchGrid(matches, true, appState.favoriteTeam, appState.standings, { hasFilters: hasActiveFilters(appState) })}</div>`;
}

function renderGroups(appState) {
  const groups = groupLetters.filter((group) => groupMatchesQuery(appState, group));
  if (!groups.length) return `<div class="groups-grid"><div class="empty">No groups or teams match the current search.</div></div>`;
  return `<div class="groups-grid">${groups.map((group) => groupTable(appState, group)).join("")}</div>`;
}

function renderStats(appState) {
  const config = statsConfig(appState)[appState.statsTab] || statsConfig(appState).playerGoals;
  const items = filterStatItems(appState, config.items());
  return `
    <div class="stats-view">
      <div class="stats-tabs">
        ${statsTabs.map((tab) => `
          <button class="stats-tab ${tab.id === appState.statsTab ? "active" : ""}" type="button" data-stats-tab="${escapeHtml(tab.id)}">
            ${statsTabIcon(tab)}<span>${tab.label}</span>
          </button>
        `).join("")}
      </div>
      <div class="stats-board">
        <div class="stats-board-head">
          <strong>${escapeHtml(config.title)}</strong>
          <span>Top ${items.length}</span>
        </div>
        ${statsRows(appState, items, config)}
      </div>
    </div>
  `;
}

function renderBracketView(appState) {
  const knockout = appState.matches.filter((match) => !match.group && matchMatchesQuery(appState, match));
  return renderBracket(knockout, {
    favoriteTeam: appState.favoriteTeam,
    query: appState.query,
    seedData: window.SEED_DATA
  });
}

function groupTable(appState, group) {
  const rows = (appState.standings[group] || appState.groups[group].map(emptyStanding)).map((row, index) => `
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
  return `
    <article class="group-card">
      <div class="group-head"><strong>Group ${group}</strong><span>${groupChips(appState.groups[group] || [])}</span></div>
      <table><thead><tr><th></th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr></thead><tbody>${rows}</tbody></table>
    </article>
  `;
}

function statsConfig(appState) {
  return {
    playerGoals: { title: "Player Goals Leaders", valueLabel: "player goals", items: () => rankedScorers(appState) },
    teamGoals: { title: "Team Goals Leaders", valueLabel: "team goals", items: () => rankedTeamGoals(appState) },
    assists: { title: "Assists Leaders", valueLabel: "assists", items: () => rankedAssists(appState) },
    yellows: { title: "Yellow Card Leaders", valueLabel: "yellow cards", items: () => rankedCardsByKind(appState, "yellow") },
    reds: { title: "Red Card Leaders", valueLabel: "red cards", items: () => rankedCardsByKind(appState, "red") },
    teams: { title: "Team Leaders", valueLabel: "points", items: () => rankedTeams(appState) }
  };
}

function statsTabIcon(tab) {
  if (tab.icon) return `<img src="assets/${escapeHtml(tab.icon)}" alt="">`;
  return `<i>${escapeHtml(tab.iconText || tab.label[0])}</i>`;
}

function statsRows(appState, items, config) {
  if (!items.length) {
    const message = appState.query ? "No stats match the current search." : `Waiting for ${escapeHtml(config.valueLabel)} data.`;
    return `<div class="empty small">${message}</div>`;
  }
  return `<ol class="stats-list">${items.map((item, index) => `
    <li>
      <span class="stats-rank">${index + 1}</span>
      <strong>${escapeHtml(displayStatName(item))}</strong>
      <small>${escapeHtml(item.team || item.meta || "")}</small>
      <b>${escapeHtml(item.value)}</b>
    </li>
  `).join("")}</ol>`;
}

function teamCell(row) {
  return `<span class="table-team">${teamBadge(row.team, row.logo)}${escapeHtml(row.team)}</span>`;
}

function bindRootInteractions(appState) {
  els.root.querySelectorAll("[data-match-id]").forEach((node) => {
    const match = appState.matches.find((item) => String(item.id || item.number) === node.dataset.matchId);
    if (!match) return;
    node.addEventListener("click", () => openMatch(match));
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter") openMatch(match);
    });
  });

  els.root.querySelector("[data-action='clear-filters']")?.addEventListener("click", () => {
    els.search.value = "";
    updateState({ query: "", matchGroupFilter: "", matchStatusFilter: "all" });
  });

  els.root.querySelector("[data-action='group-filter']")?.addEventListener("change", (event) => {
    updateState({ matchGroupFilter: event.target.value });
  });

  els.root.querySelectorAll("[data-status-filter]").forEach((button) => {
    button.addEventListener("click", () => updateState({ matchStatusFilter: button.dataset.statusFilter }));
  });

  els.root.querySelectorAll("[data-stats-tab]").forEach((button) => {
    button.addEventListener("click", () => updateState({ statsTab: button.dataset.statsTab }));
  });
}

async function openMatch(match) {
  updateState({ selectedMatch: match, selectedSummary: null });
  renderMatchDialog(match);
  els.dialog.showModal();

  if (!match.id || !window.worldCup?.fetchMatchSummary) return;
  try {
    const summary = await espnClient.fetchAndNormalizeSummary(match.id);
    updateState({ selectedSummary: summary });
    renderMatchDialog(match, summary);
  } catch (error) {
    const summary = { error: error.message };
    updateState({ selectedSummary: summary });
    renderMatchDialog(match, summary);
  }
}

async function refreshSelectedMatch(button) {
  const selected = getState().selectedMatch;
  if (!selected?.id) return;
  if (button) {
    button.disabled = true;
    button.textContent = "Updating...";
  }
  try {
    await refreshLive({ force: true });
    const latestMatch = getState().matches.find((match) => match.id === selected.id) || selected;
    let summary = getState().selectedSummary;
    if (window.worldCup?.fetchMatchSummary) {
      summary = await espnClient.fetchAndNormalizeSummary(selected.id, { force: true });
    }
    updateState({ selectedMatch: latestMatch, selectedSummary: summary });
    renderMatchDialog(latestMatch, summary);
  } catch (error) {
    const summary = { error: error.message };
    updateState({ selectedSummary: summary });
    renderMatchDialog(getState().selectedMatch, summary);
  }
}

function renderMatchDialog(match, summary = null) {
  const appState = getState();
  const stats = summary?.stats && Object.keys(summary.stats).length ? summary.stats : match.stats;
  const timeline = summary?.plays?.length ? summary.plays : match.details;
  const meaningfulTimeline = timeline.filter(isTimelineEvent).sort(sortEventsByMinute).slice(-80);
  const keyEvents = match.goals.concat(match.cards).sort(sortEventsByMinute);
  const officials = summary?.officials?.length ? summary.officials.join(", ") : "TBD";
  const espnLink = match.links.Summary || match.links.Report || match.links.Statistics || appState.sourceUrl;

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

function hasActiveFilters(appState) {
  return Boolean(appState.query || appState.matchGroupFilter || appState.matchStatusFilter !== "all");
}
