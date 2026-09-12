import { useSyncExternalStore } from "react";

export const THEMES = [
  {
    id: "arcade",
    name: "Arcade",
    description: "Neon cabinet, pixel type, CRT scanlines.",
  },
  {
    id: "basic",
    name: "Basic",
    description: "Clean, light and minimal.",
  },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const DEFAULT_THEME: ThemeId = "arcade";
export const THEME_STORAGE_KEY = "dzz-theme";

const listeners = new Set<() => void>();

function isThemeId(v: unknown): v is ThemeId {
  return THEMES.some((t) => t.id === v);
}

function readTheme(): ThemeId {
  if (typeof document === "undefined") return DEFAULT_THEME;
  const fromDom = document.documentElement.dataset.theme;
  if (isThemeId(fromDom)) return fromDom;
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeId(stored)) return stored;
  } catch {
    /* localStorage unavailable */
  }
  return DEFAULT_THEME;
}

export function setTheme(id: ThemeId) {
  document.documentElement.dataset.theme = id;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    /* localStorage unavailable */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => DEFAULT_THEME);
  return { theme, setTheme, themes: THEMES };
}

/**
 * Runs inline in <head> before first paint so the stored theme applies
 * without a flash of the default skin.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}})();`;
