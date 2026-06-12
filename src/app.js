const groupLetters = Object.keys(window.SEED_DATA.groups);

const state = {
  view: "today",
  query: "",
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
  today: "Today",
  matches: "Match Center",
  groups: "Groups",
  bracket: "Knockout"
};

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
  Tunisia: "TUN", Turkey: "TUR", "Turkiye": "TUR", "United States": "USA", Uruguay: "URU",
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
  Switzerland: "ch", Tunisia: "tn", Turkey: "tr", "Turkiye": "tr", "United States": "us",
  Uruguay: "uy", Uzbekistan: "uz"
};

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
  dialog: document.getElementById("matchDialog"),
  dialogBody: document.getElementById("matchDialogBody")
};

recalculateStandings();
render();
refreshLive();
setInterval(refreshLive, 30_000);

document.querySelectorAll(".nav-button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.view = button.dataset.view;
    render();
  });
});

els.search.addEventListener("input", (event) => {
  state.query = event.target.value.trim().toLowerCase();
  render();
});

els.refresh.addEventListener("click", refreshLive);

async function refreshLive() {
  setLiveStatus("Syncing", "ESPN live");
  try {
    const payload = await window.worldCup.fetchLive();
    const parsed = parseEspnScoreboard(payload.data);
    if (parsed.matches.length) {
      state.matches = parsed.matches;
      state.groups = { ...state.groups, ...parsed.groups };
      state.source = payload.sourceName;
      state.sourceUrl = payload.sourceUrl;
      state.lastUpdated = payload.fetchedAt;
      state.liveError = null;
      recalculateStandings(false);
      setLiveStatus("Live", formatDateTime(payload.fetchedAt));
    } else {
      throw new Error("ESPN returned no World Cup events.");
    }
  } catch (error) {
    state.liveError = error.message;
    setLiveStatus("Offline data", error.message || "Sync unavailable");
  }
  render();
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
  const team = competitors.find((item) => String(item.id) === teamId || String(item.team?.id) === teamId)?.team?.displayName || detail.play?.team?.displayName || "";
  const athlete = detail.athletesInvolved?.[0]?.displayName || detail.play?.participants?.[0]?.athlete?.displayName || "";
  const lower = text.toLowerCase();
  let kind = "event";
  if (detail.scoringPlay || lower.includes("goal")) kind = "goal";
  if (detail.yellowCard || lower.includes("yellow")) kind = "yellow";
  if (detail.redCard || lower.includes("red card")) kind = "red";
  if (lower.includes("substitution")) kind = "sub";
  return {
    kind,
    minute: detail.clock?.displayValue || detail.time?.displayValue || "",
    team,
    athlete,
    text: detail.play?.text || detail.text || [athlete, text].filter(Boolean).join(" - "),
    type: text
  };
}

function mapStats(stats) {
  return Object.fromEntries(stats.map((stat) => [stat.name, {
    label: stat.label || stat.displayName || statLabels[stat.name] || stat.abbreviation || stat.name,
    value: stat.displayValue ?? String(stat.value ?? "")
  }]));
}

async function openMatch(match) {
  state.selectedMatch = match;
  state.selectedSummary = null;
  renderMatchDialog(match);
  els.dialog.showModal();

  if (!match.id || !window.worldCup.fetchMatchSummary) return;
  try {
    const payload = await window.worldCup.fetchMatchSummary(match.id);
    state.selectedSummary = normalizeSummary(payload.data);
    renderMatchDialog(match, state.selectedSummary);
  } catch (error) {
    state.selectedSummary = { error: error.message };
    renderMatchDialog(match, state.selectedSummary);
  }
}

function normalizeSummary(summary) {
  const teams = summary.boxscore?.teams || [];
  const stats = Object.fromEntries(teams.map((item) => [item.team.displayName, mapStats(item.statistics || [])]));
  const plays = (summary.plays || []).map((play) => normalizeDetail(play)).filter((play) => play.text);
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

function render() {
  els.title.textContent = viewTitles[state.view];
  renderSummary();
  const renderers = { today: renderToday, matches: renderMatches, groups: renderGroups, bracket: renderBracket };
  els.root.innerHTML = "";
  els.root.appendChild(renderers[state.view]());
}

function renderSummary() {
  const metrics = tournamentMetrics();
  els.summary.innerHTML = [
    summaryCard("Golden boot", metrics.leadingScorer.name, metrics.leadingScorer.detail),
    summaryCard("Next kickoff", metrics.nextMatch.value, metrics.nextMatch.detail),
    summaryCard("Latest result", metrics.latestResult.value, metrics.latestResult.detail)
  ].join("");
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
  wrap.append(matchGrid(filterMatches(state.matches), true));
  return wrap;
}

function renderGroups() {
  const grid = div("groups-grid");
  groupLetters.forEach((group) => grid.append(groupTable(group)));
  return grid;
}

function renderBracket() {
  const wrap = div("bracket-page");
  const knockout = state.matches.filter((match) => !match.group);
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
      placeholder.innerHTML = `<span>${fallback?.[2] || "Awaiting qualifiers"}</span>`;
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
    <div class="bracket-team ${winner ? "winner" : ""}">
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
  const scoring = match.goals.map((goal) => `${goal.minute} ${goal.athlete || goal.team}`).join(", ");
  card.innerHTML = `
    <div class="match-meta">
      <span>${escapeHtml(match.stage)}${match.group ? ` / Group ${match.group}` : ""}</span>
      <strong>${escapeHtml(match.status)}</strong>
    </div>
    <div class="teams">
      ${teamLine(match.home, match.homeLogo, match.homeScore, match.homeAbbr)}
      ${teamLine(match.away, match.awayLogo, match.awayScore, match.awayAbbr)}
    </div>
    <div class="match-footer">
      <span>${formatMatchDate(match.date)} / ${escapeHtml(match.time)}</span>
      <span>${escapeHtml(match.broadcasts.slice(0, 3).join(", ") || "Broadcast TBD")}</span>
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
    <div class="team-line">
      ${teamBadge(name, logo, abbr)}
      <strong>${escapeHtml(name)}</strong>
      <span class="team-score">${Number.isFinite(score) ? score : "-"}</span>
    </div>
  `;
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
  const panel = div("pulse-panel");
  panel.innerHTML = `
    <article>
      <span>Top scorers</span>
      ${leaderList(metrics.scorers)}
    </article>
    <article class="group-leaders-card">
      <span>Group leaders</span>
      ${leaderList(metrics.groupLeaders, 12)}
    </article>
  `;
  return panel;
}

function leaderList(items, limit = 4) {
  if (!items.length) return `<div class="empty small">Waiting for match data.</div>`;
  return `<ol class="leader-list">${items.slice(0, limit).map((item) => `
    <li><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.detail)}</span></li>
  `).join("")}</ol>`;
}

function teamCell(row) {
  return `<span class="table-team">${teamBadge(row.team, row.logo)}${escapeHtml(row.team)}</span>`;
}

function renderMatchDialog(match, summary = null) {
  const stats = summary?.stats && Object.keys(summary.stats).length ? summary.stats : match.stats;
  const timeline = summary?.plays?.length ? summary.plays : match.details;
  const meaningfulTimeline = timeline.filter((item) => ["goal", "yellow", "red", "sub"].includes(item.kind) || /shot|foul|corner|penalty|end|start/i.test(item.text)).slice(-80);
  const officials = summary?.officials?.length ? summary.officials.join(", ") : "TBD";
  const espnLink = match.links.Summary || match.links.Report || match.links.Statistics || state.sourceUrl;

  els.dialogBody.innerHTML = `
    <div class="dialog-header">
      <p class="eyebrow">${escapeHtml(match.stage)}${match.group ? ` / Group ${match.group}` : ""}</p>
      <h2>${escapeHtml(match.home)} ${scoreText(match)} ${escapeHtml(match.away)}</h2>
      <span class="status-pill">${escapeHtml(match.status)}</span>
    </div>
    <div class="detail-grid">
      ${detailTile("Kickoff", `${formatMatchDate(match.date)} / ${match.time}`)}
      ${detailTile("Broadcast", match.broadcasts.join(", ") || "TBD")}
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
        ${eventList(match.goals.concat(match.cards))}
      </section>
    </div>
    <section>
      <h3>Timeline</h3>
      ${eventList(meaningfulTimeline, true)}
    </section>
    <button class="text-link" data-url="${escapeHtml(espnLink)}">Open ESPN match page</button>
  `;

  els.dialogBody.querySelector(".text-link")?.addEventListener("click", (event) => {
    window.worldCup.openExternal(event.currentTarget.dataset.url);
  });
}

function detailTile(label, value) {
  return `<article class="detail-tile"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value || "TBD"))}</strong></article>`;
}

function statsTable(match, stats) {
  const left = stats[match.home] || {};
  const right = stats[match.away] || {};
  const keys = ["totalGoals", "totalShots", "shotsOnTarget", "possessionPct", "wonCorners", "foulsCommitted", "yellowCards", "redCards", "offsides", "saves", "totalPasses", "accuratePasses"];
  const rows = keys.map((key) => {
    const label = left[key]?.label || right[key]?.label || statLabels[key] || key;
    const leftValue = left[key]?.value || "-";
    const rightValue = right[key]?.value || "-";
    return `<tr><td>${escapeHtml(leftValue)}</td><th>${escapeHtml(label)}</th><td>${escapeHtml(rightValue)}</td></tr>`;
  }).join("");
  return `<table class="stats-table"><thead><tr><th>${escapeHtml(match.homeAbbr || match.home)}</th><th></th><th>${escapeHtml(match.awayAbbr || match.away)}</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function eventList(events, dense = false) {
  if (!events.length) return `<div class="empty small">No events reported yet.</div>`;
  return `<ol class="event-list ${dense ? "dense" : ""}">${events.map((event) => `
    <li class="${event.kind}">
      <span>${escapeHtml(event.minute || "")}</span>
      <div><strong>${escapeHtml(eventLabel(event))}</strong><small>${escapeHtml(event.text || event.team || "")}</small></div>
    </li>
  `).join("")}</ol>`;
}

function eventLabel(event) {
  if (event.kind === "goal") return `Goal ${event.athlete || event.team}`;
  if (event.kind === "yellow") return `Yellow card ${event.athlete || event.team}`;
  if (event.kind === "red") return `Red card ${event.athlete || event.team}`;
  if (event.kind === "sub") return "Substitution";
  return event.type || event.team || "Event";
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
      ? { value: `${next.homeAbbr || codeForTeam(next.home)} vs ${next.awayAbbr || codeForTeam(next.away)}`, detail: `${formatMatchDate(next.date)} / ${next.time}` }
      : { value: "No upcoming match", detail: "schedule complete" },
    latestResult: latest
      ? { value: `${latest.homeAbbr || codeForTeam(latest.home)} ${safeScore(latest.homeScore)}-${safeScore(latest.awayScore)} ${latest.awayAbbr || codeForTeam(latest.away)}`, detail: `${formatMatchDate(latest.date)} / ${latest.status}` }
      : { value: "No final yet", detail: "waiting for results" }
  };
}

function rankedScorers() {
  const totals = new Map();
  state.matches.forEach((match) => {
    match.goals.forEach((goal) => {
      const name = goal.athlete || goal.team || "Unknown scorer";
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
      detail: `${item.goals} goal${item.goals === 1 ? "" : "s"}${item.teams.size ? ` / ${[...item.teams][0]}` : ""}`
    }));
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
      detail: `${item.yellow}Y / ${item.red}R${item.team ? ` / ${item.team}` : ""}`
    }));
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
  return matches.filter((match) => [
    match.home, match.away, match.group, match.venue, match.city, match.stage, match.status,
    ...match.goals.map((goal) => goal.athlete), ...match.cards.map((card) => card.athlete)
  ].join(" ").toLowerCase().includes(state.query));
}

function setLiveStatus(status, detail) {
  els.liveStatus.textContent = status;
  els.liveDetail.textContent = detail;
}

function summaryCard(label, value, detail) {
  return `<article class="summary-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small></article>`;
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

function flagUrlForTeam(team) {
  const code = teamFlagCodes[team];
  return code ? `https://flagcdn.com/w40/${code}.png` : "";
}

function teamBadge(name, logo = "", abbr = "") {
  const flag = flagUrlForTeam(name);
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
