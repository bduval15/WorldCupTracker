import {
  SUMMARY_FINAL_MS,
  SUMMARY_LIVE_MS,
  groupLetters,
  statLabels
} from "../utils/constants.js";
import {
  formatKickoff,
  normalizeStage
} from "../utils/formatters.js";

const summaryFetchedAt = new Map();

function shouldHydrateSummary(match, force = false) {
  if (!match.id || match.statusState === "pre" || !window.worldCup?.fetchMatchSummary) return false;
  if (force) return true;
  const lastFetched = summaryFetchedAt.get(match.id) || 0;
  const age = Date.now() - lastFetched;
  if (!lastFetched && (!match.details?.length || !Object.keys(match.stats || {}).length)) return true;
  if (match.statusState === "in") return age > SUMMARY_LIVE_MS;
  return age > SUMMARY_FINAL_MS;
}

function mergePreviousMatchData(matches, previousMatches = []) {
  const previous = new Map(previousMatches.filter((match) => match.id).map((match) => [match.id, match]));
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
}

export async function fetchAndNormalizeLive(options = {}) {
  const payload = await window.worldCup.fetchLive({ force: Boolean(options.force) });
  const parsed = parseEspnScoreboard(payload.data);
  mergePreviousMatchData(parsed.matches, options.previousMatches);
  await hydrateMatchSummaries(parsed.matches, options);
  return {
    ...payload,
    groups: parsed.groups,
    matches: parsed.matches
  };
}

export async function fetchAndNormalizeSummary(id, options = {}) {
  const payload = await window.worldCup.fetchMatchSummary(id, { force: Boolean(options.force) });
  summaryFetchedAt.set(id, Date.now());
  return normalizeSummary(payload.data);
}

async function hydrateMatchSummaries(matches, options = {}) {
  const hydrateable = matches.filter((match) => shouldHydrateSummary(match, options.force));
  await Promise.allSettled(hydrateable.map(async (match) => {
    const summary = await fetchAndNormalizeSummary(match.id, { force: Boolean(options.force) });
    if (summary.stats && Object.keys(summary.stats).length) match.stats = summary.stats;
    if (summary.plays.length) {
      match.details = summary.plays;
      match.goals = summary.plays.filter((detail) => detail.kind === "goal");
      match.cards = summary.plays.filter((detail) => detail.kind === "yellow" || detail.kind === "red");
    }
  }));
}

export function parseEspnScoreboard(data) {
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

export function normalizeEspnEvent(event, fallbackNumber) {
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

export function normalizeDetail(detail, competitors = []) {
  const text = detail.type?.text || detail.play?.type?.text || "";
  const teamId = String(detail.team?.id || detail.play?.team?.id || "");
  const team = competitors.find((item) => String(item.id) === teamId || String(item.team?.id) === teamId)?.team?.displayName || detail.team?.displayName || detail.play?.team?.displayName || "";
  const athletes = extractParticipantNames(detail);
  const athlete = athletes[0] || "";
  const assist = athletes[1] || extractAssistName(detail.text || detail.play?.text || "");
  const detailText = detail.play?.text || detail.text || [athlete, text].filter(Boolean).join(" - ");
  const typeLower = text.toLowerCase();
  const kind = classifyEspnEventType(typeLower, detail);
  const ownGoal = /\bown goal\b/.test(typeLower) || (kind === "goal" && /\bown goal\b/i.test(detailText));
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

export function classifyEspnEventType(typeLower, detail = {}) {
  if (detail.scoringPlay || /\b(own goal|goal)\b/.test(typeLower)) return "goal";
  if (detail.redCard || /\bred card\b|\bred\b/.test(typeLower)) return "red";
  if (detail.yellowCard || /\byellow card\b|\byellow\b/.test(typeLower)) return "yellow";
  if (/\bsubstitution\b|\bsubstitute\b/.test(typeLower)) return "sub";
  if (/\battempt saved\b|\bsave\b|\bsaved\b/.test(typeLower)) return "save";
  if (/\battempt blocked\b|\bshot blocked\b|\bblocked shot\b/.test(typeLower)) return "shotBlocked";
  if (/\battempt missed\b|\bshot off target\b|\bmissed shot\b/.test(typeLower)) return "shotOff";
  if (/\bshot on target\b/.test(typeLower)) return "shotOn";
  if (/\bassist\b/.test(typeLower)) return "assist";
  if (/\bcorner\b/.test(typeLower)) return "corner";
  if (/\boffside\b/.test(typeLower)) return "offside";
  if (/\bfoul\b/.test(typeLower)) return "foul";
  if (/\bpenalty\b/.test(typeLower)) return "penalty";
  return "event";
}

export function mapStats(stats) {
  return Object.fromEntries(stats.map((stat) => [stat.name, {
    label: stat.label || stat.displayName || statLabels[stat.name] || stat.abbreviation || stat.name,
    value: stat.displayValue ?? String(stat.value ?? "")
  }]));
}

export function extractParticipantNames(detail) {
  const groups = [detail.athletesInvolved, detail.participants, detail.play?.participants];
  const source = groups.find((items) => Array.isArray(items) && items.length) || [];
  return source.map((item) => item.displayName || item.athlete?.displayName).filter(Boolean);
}

export function extractAssistName(text) {
  const match = String(text || "").match(/Assisted by ([^.]+?)(?: with | following |\.|$)/i);
  return match ? match[1].trim() : "";
}

export function normalizeSummary(summary) {
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

export function uniqueEvents(events) {
  const seen = new Set();
  return events.filter((event) => {
    const key = [event.minute, event.kind, event.athlete, event.text].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function createSeedMatches() {
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

export const espnClient = {
  fetchAndNormalizeLive,
  fetchAndNormalizeSummary,
  parseEspnScoreboard,
  normalizeEspnEvent,
  normalizeDetail,
  classifyEspnEventType,
  mapStats,
  extractParticipantNames,
  extractAssistName,
  createSeedMatches
};
