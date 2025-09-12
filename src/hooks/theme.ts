// Simple theme manager with system detection, persistence, and global application.
// Public API:
// - initThemeManager(): initialize listeners + apply persisted choice
// - getThemePreference(): "system" | "light" | "dark"
// - setThemePreference(pref): apply + persist

export type ThemePref = "system" | "light" | "dark";
const STORAGE_KEY = "theme";

function applyResolvedTheme(pref: ThemePref) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  const effectiveDark = pref === "dark" || (pref === "system" && prefersDark);
  if (effectiveDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  // Notify listeners (if any) that theme changed
  window.dispatchEvent(new CustomEvent("themechange", { detail: { pref } }));
}

export function getThemePreference(): ThemePref {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark" || saved === "system") return saved;
  return "system";
}

export function setThemePreference(pref: ThemePref) {
  localStorage.setItem(STORAGE_KEY, pref);
  applyResolvedTheme(pref);
}

let initialized = false;
export function initThemeManager() {
  if (initialized) return;
  initialized = true;

  // Initial apply
  applyResolvedTheme(getThemePreference());

  // Listen to system changes only when pref is system
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystemChange = () => {
    if (getThemePreference() === "system") {
      applyResolvedTheme("system");
    }
  };
  // addEventListener is supported; fallback for older engines
  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", onSystemChange);
  } else if (typeof (media as any).addListener === "function") {
    (media as any).addListener(onSystemChange);
  }

  // Also react if someone else changes the setting (another tab)
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      applyResolvedTheme(getThemePreference());
    }
  });
}
