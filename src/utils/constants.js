export const groupLetters = Object.keys(window.SEED_DATA.groups);

export const INITIAL_REFRESH_MIN_MS = 5_000;
export const INITIAL_REFRESH_MAX_MS = 20_000;
export const IDLE_REFRESH_MIN_MS = 3 * 60_000;
export const IDLE_REFRESH_MAX_MS = 5 * 60_000;
export const LIVE_REFRESH_MIN_MS = 15_000;
export const LIVE_REFRESH_MAX_MS = 25_000;
export const SUMMARY_LIVE_MS = 30_000;
export const SUMMARY_FINAL_MS = 12 * 60 * 60_000;

export const viewTitles = {
  today: "Home",
  matches: "Match Center",
  stats: "Stats",
  groups: "Groups",
  bracket: "Knockout"
};

export const searchPlaceholders = {
  today: "Search teams, groups, matches",
  matches: "Search teams, groups, dates, scores, status",
  stats: "Search player names, teams, stats",
  groups: "Search groups or teams",
  bracket: "Search teams, rounds, match numbers"
};

export const statsTabs = [
  { id: "playerGoals", label: "Player Goals", icon: "soccer-ball.svg" },
  { id: "teamGoals", label: "Team Goals", icon: "team-goals.svg" },
  { id: "assists", label: "Assists", icon: "assist.svg" },
  { id: "yellows", label: "Yellows", icon: "yellow-card.svg" },
  { id: "reds", label: "Reds", icon: "red-card.svg" },
  { id: "teams", label: "Teams", icon: "teams.svg" }
];

export const stageOrder = [
  "Round of 32",
  "Round of 16",
  "Quarterfinals",
  "Semifinals",
  "Final"
];

export const bracketVisualOrder = {
  "Round of 32": [73, 75, 74, 77, 83, 84, 81, 82, 76, 78, 79, 80, 86, 88, 85, 87],
  "Round of 16": [89, 90, 93, 94, 91, 92, 95, 96],
  Quarterfinals: [97, 98, 99, 100],
  Semifinals: [101, 102],
  Final: [104]
};

export const officialMatchByEntrants = new Map([
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

export const teamCodes = {
  Algeria: "ALG", Argentina: "ARG", Australia: "AUS", Austria: "AUT", Belgium: "BEL",
  "Bosnia and Herzegovina": "BIH", "Bosnia-Herzegovina": "BIH", Brazil: "BRA", Canada: "CAN",
  "Cape Verde": "CPV", Colombia: "COL", Croatia: "CRO", Curacao: "CUW",
  "Czech Republic": "CZE", Czechia: "CZE", "DR Congo": "COD", Ecuador: "ECU", Egypt: "EGY",
  England: "ENG", France: "FRA", Germany: "GER", Ghana: "GHA", Haiti: "HAI", Iran: "IRN",
  Iraq: "IRQ", "Ivory Coast": "CIV", Japan: "JPN", Jordan: "JOR", Mexico: "MEX", Morocco: "MAR",
  Netherlands: "NED", "New Zealand": "NZL", Norway: "NOR", Panama: "PAN", Paraguay: "PAR",
  Portugal: "POR", Qatar: "QAT", "Saudi Arabia": "KSA", Scotland: "SCO", Senegal: "SEN",
  "South Africa": "RSA", "South Korea": "KOR", Spain: "ESP", Sweden: "SWE", Switzerland: "SUI",
  Tunisia: "TUN", Turkey: "TUR", Turkiye: "TUR", "United States": "USA", Uruguay: "URU",
  Uzbekistan: "UZB"
};

export const teamFlagCodes = {
  Algeria: "dz", Argentina: "ar", Australia: "au", Austria: "at", Belgium: "be",
  "Bosnia and Herzegovina": "ba", "Bosnia-Herzegovina": "ba", Brazil: "br", Canada: "ca",
  "Cape Verde": "cv", Colombia: "co", Croatia: "hr", Curacao: "cw",
  "Czech Republic": "cz", Czechia: "cz", "DR Congo": "cd", "Congo DR": "cd", Ecuador: "ec",
  Egypt: "eg", England: "gb-eng", France: "fr", Germany: "de", Ghana: "gh", Haiti: "ht",
  Iran: "ir", Iraq: "iq", "Ivory Coast": "ci", Japan: "jp", Jordan: "jo", Mexico: "mx",
  Morocco: "ma", Netherlands: "nl", "New Zealand": "nz", Norway: "no", Panama: "pa",
  Paraguay: "py", Portugal: "pt", Qatar: "qa", "Saudi Arabia": "sa", Scotland: "gb-sct",
  Senegal: "sn", "South Africa": "za", "South Korea": "kr", Spain: "es", Sweden: "se",
  Switzerland: "ch", Tunisia: "tn", Turkey: "tr", Turkiye: "tr", "United States": "us",
  Uruguay: "uy", Uzbekistan: "uz"
};

export const teamThemes = {
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

export const fallbackTheme = ["#11c58d", "#f8cf52", "#d92945"];

export const statLabels = {
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
