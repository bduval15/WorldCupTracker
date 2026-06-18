import { stageOrder } from "../utils/constants.js";
import {
  bracketSlotLabel,
  bracketSortKey,
  escapeHtml,
  formatMatchDate,
  groupBy,
  isWinner,
  officialMatchNumber,
  stageClass,
  teamBadge
} from "../utils/formatters.js";
import { matchCard } from "./MatchCard.js";

export function renderBracket(knockoutMatches, options = {}) {
  const { favoriteTeam = "", query = "", seedData = window.SEED_DATA } = options;
  const byStage = groupBy(knockoutMatches, (match) => match.stage || "Knockout");
  const columns = stageOrder.map((stage) => {
    const matches = (byStage[stage] || []).sort((a, b) => bracketSortKey(stage, a) - bracketSortKey(stage, b));
    const fallback = seedData.knockout.find(([round]) => round === stage);
    const body = matches.length
      ? matches.map((match, index) => bracketMatchCard(match, stage, index, favoriteTeam)).join("")
      : `<div class="bracket-placeholder"><span>${query ? "No matching matches" : fallback?.[2] || "Awaiting qualifiers"}</span></div>`;
    return `
      <div class="bracket-column" data-stage="${stageClass(stage)}">
        <div class="bracket-column-head"><strong>${stage}</strong><span>${fallback?.[1] || ""}</span></div>
        ${body}
      </div>
    `;
  }).join("");

  const thirdPlace = (byStage["Third place"] || []).sort((a, b) => new Date(a.date) - new Date(b.date));
  const thirdPlaceHtml = thirdPlace.length
    ? `<div class="placement-match"><h2 class="section-title">Third Place</h2>${thirdPlace.map((match) => matchCard(match, false, favoriteTeam)).join("")}</div>`
    : "";

  return `
    <div class="bracket-page">
      <div class="bracket-board">${columns}</div>
      ${thirdPlaceHtml}
      ${bracketLegend()}
    </div>
  `;
}

export function bracketMatchCard(match, _stage, _index, favoriteTeam = "") {
  const matchNumber = officialMatchNumber(match);
  return `
    <article class="bracket-match ${match.completed ? "is-final" : ""} ${match.statusState === "in" ? "is-live" : ""}" tabindex="0" data-match-id="${escapeHtml(match.id || match.number)}">
      <div class="bracket-match-meta"><span>${matchNumber ? `Match ${matchNumber}` : formatMatchDate(match.date)}</span><strong>${escapeHtml(match.status)}</strong></div>
      ${bracketTeam(match.home, match.homeLogo, match.homeScore, isWinner(match, "home"), match.homeAbbr, favoriteTeam)}
      ${bracketTeam(match.away, match.awayLogo, match.awayScore, isWinner(match, "away"), match.awayAbbr, favoriteTeam)}
    </article>
  `;
}

export function bracketTeam(name, logo, score, winner, abbr = "", favoriteTeam = "") {
  return `
    <div class="bracket-team ${winner ? "winner" : ""} ${name === favoriteTeam ? "favorite-team" : ""}">
      ${teamBadge(name, logo, abbr)}
      <span>${escapeHtml(bracketSlotLabel(name))}</span>
      <strong>${Number.isFinite(score) ? score : "-"}</strong>
    </div>
  `;
}

export function bracketLegend() {
  return `
    <div class="bracket-legend">
      <span><i class="legend-dot live"></i>Live</span>
      <span><i class="legend-dot final"></i>Completed</span>
      <span><i class="legend-dot winner"></i>Advancing</span>
    </div>
  `;
}

export { bracketSortKey, officialMatchNumber };
