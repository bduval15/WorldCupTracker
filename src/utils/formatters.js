import {
  bracketVisualOrder,
  officialMatchByEntrants,
  teamCodes,
  teamFlagCodes
} from "./constants.js";

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

export function formatMatchDate(value) {
  if (!value) return "TBD";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

export function formatKickoff(value) {
  if (!value) return "TBD";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function formatDateTime(value) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function localDate(value) {
  return new Date(value).toLocaleDateString("en-CA");
}

export function titleCase(value) {
  return String(value).replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function codeForTeam(team) {
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

export function flagUrlForTeam(team, size = "w80") {
  const code = teamFlagCodes[team];
  return code ? `https://flagcdn.com/${size}/${code}.png` : "";
}

export function displayPlayerName(name = "") {
  const cleaned = String(name || "").trim();
  if (!cleaned || !cleaned.includes(" ")) return cleaned;
  const parts = cleaned.split(/\s+/);
  const particles = new Set(["da", "de", "del", "der", "di", "dos", "du", "la", "le", "van", "von"]);
  const last = parts.at(-1);
  const previous = parts.at(-2);
  return previous && particles.has(previous.toLowerCase()) ? `${previous} ${last}` : last;
}

export function displayStatName(item) {
  return item?.isPlayer ? displayPlayerName(item.name) : item?.name || "";
}

export function countLabel(count, noun) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function safeScore(score) {
  return Number.isFinite(score) ? score : 0;
}

export function scoreText(match) {
  return Number.isFinite(match.homeScore) && Number.isFinite(match.awayScore) ? `${match.homeScore} - ${match.awayScore}` : "vs";
}

export function badgeClass(label) {
  return `match-badge badge-${String(label).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

export function stageClass(stage) {
  return String(stage).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function normalizeStage(value) {
  const normalized = String(value || "").toLowerCase().replace(/[_-]/g, " ");
  if (normalized.includes("round of 32")) return "Round of 32";
  if (normalized.includes("rd of 16") || normalized.includes("round of 16")) return "Round of 16";
  if (normalized.includes("quarter")) return "Quarterfinals";
  if (normalized.includes("semi")) return "Semifinals";
  if (normalized.includes("3rd") || normalized.includes("third")) return "Third place";
  if (normalized.includes("final")) return "Final";
  return titleCase(value);
}

export function bracketTokenValue(token) {
  const winner = String(token).match(/^W(\d+)$/);
  if (winner) return Number(winner[1]);
  const groupSlot = String(token).match(/^([123])([A-L])/);
  if (groupSlot) return Number(groupSlot[1]) * 100 + groupSlot[2].charCodeAt(0);
  return 999;
}

export function compareBracketTokens(a, b) {
  return bracketTokenValue(a) - bracketTokenValue(b);
}

export function slotToken(name) {
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

export function bracketSlotLabel(name) {
  const value = String(name || "");
  return value
    .replace(/Round of 32\s+(\d+)\s+Winner/i, (_all, number) => `Winner Match ${72 + Number(number)}`)
    .replace(/Round of 16\s+(\d+)\s+Winner/i, (_all, number) => `Winner Match ${88 + Number(number)}`)
    .replace(/Quarterfinal\s+(\d+)\s+Winner/i, (_all, number) => `Winner Match ${96 + Number(number)}`)
    .replace(/Semifinal\s+(\d+)\s+Winner/i, (_all, number) => `Winner Match ${100 + Number(number)}`);
}

export function officialMatchNumber(match) {
  const tokens = [slotToken(match.home), slotToken(match.away)].filter(Boolean).sort(compareBracketTokens);
  return officialMatchByEntrants.get(tokens.join("|")) || 0;
}

export function bracketSortKey(stage, match) {
  const matchNumber = officialMatchNumber(match);
  const visualOrder = bracketVisualOrder[stage] || [];
  const position = visualOrder.indexOf(matchNumber);
  if (position >= 0) return position;
  return 1000 + new Date(match.date).getTime();
}

export function teamBadge(name, logo = "", abbr = "", flagSize = "w80") {
  const flag = flagUrlForTeam(name, flagSize);
  if (flag) return `<img class="flag-img" src="${escapeHtml(flag)}" alt="">`;
  if (logo) return `<img src="${escapeHtml(logo)}" alt="">`;
  return `<span class="team-code">${escapeHtml(abbr || codeForTeam(name))}</span>`;
}

export function groupChips(teams) {
  return teams.map((team) => `<em>${teamBadge(team)}${escapeHtml(team)}</em>`).join("");
}

export function matchGoalTotal(match) {
  if (Number.isFinite(match.homeScore) && Number.isFinite(match.awayScore)) {
    return match.homeScore + match.awayScore;
  }
  return match.goals.length;
}

export function emptyStanding(team, logo = "") {
  return { team, logo, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
}

export function sortTable(a, b) {
  return b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team);
}

export function isWinner(match, side) {
  if (!match.completed || !Number.isFinite(match.homeScore) || !Number.isFinite(match.awayScore)) return false;
  if (match.homeScore === match.awayScore) return false;
  return side === "home" ? match.homeScore > match.awayScore : match.awayScore > match.homeScore;
}

export function groupBy(items, getKey) {
  return items.reduce((groups, item) => {
    const key = getKey(item);
    groups[key] = groups[key] || [];
    groups[key].push(item);
    return groups;
  }, {});
}

export function isTimelineEvent(event) {
  const text = `${event.type || ""} ${event.text || ""}`.toLowerCase();
  if (/delay|var check|injury break|cooling break/.test(text)) return false;
  return ["goal", "assist", "yellow", "red", "sub"].includes(event.kind)
    || /shot|foul|corner|penalty|offside|save|miss|blocked/i.test(text);
}

export function sortEventsByMinute(a, b) {
  return eventMinuteValue(a) - eventMinuteValue(b);
}

export function eventMinuteValue(event) {
  const raw = String(event.minute || "");
  const match = raw.match(/(\d+)(?:\D+(\d+))?/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  return Number(match[1]) * 100 + Number(match[2] || 0);
}

export function eventLabel(event) {
  const actor = event.athlete ? displayPlayerName(event.athlete) : event.team;
  if (event.kind === "goal") return event.ownGoal ? `Own goal ${actor}` : `Goal ${actor}`;
  if (event.kind === "assist") return `Assist ${actor}`;
  if (event.kind === "yellow") return `Yellow card ${actor}`;
  if (event.kind === "red") return `Red card ${actor}`;
  if (event.kind === "sub") return "Substitution";
  if (event.kind === "save") return `Shot saved ${actor}`.trim();
  if (event.kind === "shotOn") return `Shot on target ${actor}`.trim();
  if (event.kind === "shotOff") return `Shot off target ${actor}`.trim();
  if (event.kind === "shotBlocked") return `Shot blocked ${actor}`.trim();
  return event.type || event.team || "Event";
}

export function eventDescription(event) {
  const label = eventLabel(event);
  const text = event.text || event.team || "";
  if (!text || text === event.type || text === label) return "";
  return text;
}

export function searchableText(values) {
  return values.filter(Boolean).join(" ").toLowerCase();
}
