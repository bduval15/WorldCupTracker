import { fallbackTheme, searchPlaceholders, teamThemes } from "../utils/constants.js";
import { escapeHtml } from "../utils/formatters.js";

export const els = {
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
  brandTitle: document.getElementById("brandTitle"),
  brandSubtitle: document.getElementById("brandSubtitle"),
  favoriteSelect: document.getElementById("favoriteTeamSelect"),
  compactButton: document.getElementById("compactModeButton"),
  compactNavButton: document.getElementById("compactNavButton"),
  dialog: document.getElementById("matchDialog"),
  dialogBody: document.getElementById("matchDialogBody")
};

export function setLiveStatus(status, detail) {
  els.liveStatus.textContent = status;
  els.liveDetail.textContent = detail;
  els.liveDetail.hidden = !detail;
  els.compactLiveStatus.textContent = status;
  els.compactLiveDetail.textContent = detail;
  els.compactLiveDetail.hidden = !detail;
}

export function applyCompactMode(enabled) {
  document.body.classList.toggle("compact-mode", enabled);
  els.compactButton.textContent = enabled ? "Full" : "Compact";
  els.compactNavButton.textContent = enabled ? "Full" : "Compact";
  els.compactButton.setAttribute("aria-pressed", String(enabled));
  els.compactNavButton.setAttribute("aria-pressed", String(enabled));
  window.worldCup?.setCompactMode?.(enabled);
}

export function applyFavoriteTheme(favoriteTeam) {
  const [primary, secondary, third] = teamThemes[favoriteTeam] || fallbackTheme;
  document.documentElement.style.setProperty("--team-primary", primary);
  document.documentElement.style.setProperty("--team-secondary", secondary);
  document.documentElement.style.setProperty("--team-third", third);
  document.documentElement.style.setProperty("--trophy", `linear-gradient(90deg, ${primary}, ${secondary}, ${third})`);
}

export function updateSearchUi(view) {
  els.search.placeholder = searchPlaceholders[view] || "Search teams and matches";
  els.search.disabled = false;
  els.search.removeAttribute("aria-disabled");
}

export function sectionTitle(text) {
  const title = document.createElement("h2");
  title.className = "section-title";
  title.textContent = text;
  return title;
}

export function div(className) {
  const element = document.createElement("div");
  element.className = className;
  return element;
}

export function summaryCard(label, value, detail, action = "") {
  const actionAttr = action ? ` data-summary-action="${escapeHtml(action)}"` : "";
  return `<article class="summary-card"${actionAttr}><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small></article>`;
}
