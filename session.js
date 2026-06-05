import { SESSION_VERSION, STORAGE_KEY, THEME_OPTIONS } from "./config.js?v=fit-22";

export function buildSessionPayload({ markdown, globalTheme, currentIndex }) {
  return {
    version: SESSION_VERSION,
    markdown,
    globalTheme,
    currentIndex,
    updatedAt: new Date().toISOString(),
  };
}

export function writeSessionToStorage(session) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage errors in restricted environments.
  }
}

export function readSessionFromStorage() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function updateUrlState({ globalTheme, currentIndex }) {
  const url = new URL(window.location.href);
  url.searchParams.set("theme", globalTheme);
  url.searchParams.set("slide", String(currentIndex + 1));
  window.history.replaceState({}, "", url);
}

export function readUrlState() {
  const url = new URL(window.location.href);
  const theme = url.searchParams.get("theme");
  const slide = Number.parseInt(url.searchParams.get("slide") || "", 10);

  return {
    theme: Object.hasOwn(THEME_OPTIONS, theme) ? theme : null,
    slideIndex: Number.isFinite(slide) && slide > 0 ? slide - 1 : null,
  };
}

export function createDownload(filename, content, type) {
  const blob = new Blob([content], { type });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

export function slugify(value) {
  return String(value || "deck")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "deck";
}
