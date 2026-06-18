import {
  badgeClass,
  codeForTeam,
  countLabel,
  displayPlayerName,
  escapeHtml,
  formatMatchDate,
  matchGoalTotal,
  teamBadge
} from "../utils/formatters.js";

export function matchGrid(matches, showDetails, favoriteTeam = "", standings = {}, options = {}) {
  if (!matches.length) return `<div class="match-grid">${emptyMatchesState(options)}</div>`;
  return `<div class="match-grid">${matches.map((match) => matchCard(match, showDetails, favoriteTeam, standings)).join("")}</div>`;
}

export function emptyMatchesState(options = {}) {
  const hasFilters = Boolean(options.hasFilters);
  return `
    <div class="empty action-empty">
      <strong>No matches found</strong>
      <span>${hasFilters ? "Try clearing the current search and filters." : "There are no matches in this section yet."}</span>
      ${hasFilters ? `<button class="action-button" type="button" data-action="clear-filters">Clear filters</button>` : ""}
    </div>
  `;
}

export function matchCard(match, showDetails, favoriteTeam = "", standings = {}) {
  const scoring = match.goals.map(goalScoringText).join(", ");
  const badges = matchImportanceBadges(match, standings);
  const story = matchStoryLine(match);
  return `
    <article class="match-card ${match.statusState === "in" ? "is-live" : ""}" tabindex="0" data-match-id="${escapeHtml(match.id || match.number)}">
      <div class="match-meta">
        <span>${escapeHtml(match.stage)}${match.group ? ` / Group ${match.group}` : ""}</span>
        <strong>${escapeHtml(match.status)}</strong>
      </div>
      ${badges.length ? `<div class="match-badges">${badges.map((badge) => `<span class="${badgeClass(badge)}">${escapeHtml(badge)}</span>`).join("")}</div>` : ""}
      <div class="teams">
        ${teamLine(match.home, match.homeLogo, match.homeScore, match.homeAbbr, favoriteTeam)}
        ${teamLine(match.away, match.awayLogo, match.awayScore, match.awayAbbr, favoriteTeam)}
      </div>
      <div class="match-footer">
        <span>${formatMatchDate(match.date)} / ${escapeHtml(match.time)}</span>
      </div>
      ${showDetails ? `<div class="quick-stats">
        <span>${countLabel(matchGoalTotal(match), "goal")}</span>
        <span>${countLabel(match.cards.filter((card) => card.kind === "yellow").length, "yellow")}</span>
        <span>${countLabel(match.cards.filter((card) => card.kind === "red").length, "red")}</span>
      </div>` : ""}
      ${story ? `<p class="match-story">${escapeHtml(story)}</p>` : ""}
      ${scoring ? `<p class="scorers">${escapeHtml(scoring)}</p>` : ""}
    </article>
  `;
}

export function teamLine(name, logo, score, abbr = "", favoriteTeam = "") {
  return `
    <div class="team-line ${name === favoriteTeam ? "favorite-team" : ""}">
      ${teamBadge(name, logo, abbr)}
      <strong>${escapeHtml(name)}</strong>
      <span class="team-score">${Number.isFinite(score) ? score : "-"}</span>
    </div>
  `;
}

export function goalScoringText(goal) {
  return `${goal.minute} ${goal.athlete ? displayPlayerName(goal.athlete) : goal.team}${goal.ownGoal ? " (OG)" : ""}`;
}

export function matchStoryLine(match) {
  const stories = [];
  const reds = match.cards.filter((card) => card.kind === "red").length;
  const yellows = match.cards.filter((card) => card.kind === "yellow").length;
  const ownGoals = match.goals.filter((goal) => goal.ownGoal).length;
  const topScorer = topMatchScorer(match);
  if (topScorer && topScorer.goals > 1) stories.push(`${displayPlayerName(topScorer.name)} ${topScorer.goals} goals`);
  if (ownGoals) stories.push(`${ownGoals} own goal${ownGoals === 1 ? "" : "s"}`);
  if (reds) stories.push(`${reds} red card${reds === 1 ? "" : "s"}`);
  else if (yellows >= 5) stories.push(`${yellows} yellow cards`);
  return stories.slice(0, 2).join(" / ");
}

export function topMatchScorer(match) {
  const totals = new Map();
  match.goals.filter((goal) => !goal.ownGoal).forEach((goal) => {
    const name = goal.athlete || goal.team;
    if (!name) return;
    totals.set(name, (totals.get(name) || 0) + 1);
  });
  const [name, goals] = [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] || [];
  return name ? { name, goals } : null;
}

export function matchImportanceBadges(match, standings = {}) {
  const badges = [];
  if (match.statusState === "in") badges.push("Live");
  if (match.completed) badges.push("Final");
  if (match.statusState === "pre") badges.push("Upcoming");
  if (!match.group || match.completed) return badges;
  [match.home, match.away].forEach((team) => {
    const row = standings[match.group]?.find((item) => item.team === team);
    if (!row || row.played < 1) return;
    if (row.pts >= 4) badges.push(`${codeForTeam(team)} can clinch`);
    if (row.pts <= 1 && row.played >= 2) badges.push(`${codeForTeam(team)} must win`);
  });
  return [...new Set(badges)].slice(0, 3);
}
