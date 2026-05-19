const TOUR_KEY = "cruisekube-tour-completed";

export function isTourCompleted(): boolean {
  try {
    return window.localStorage.getItem(TOUR_KEY) === "true";
  } catch {
    return false;
  }
}

export function markTourCompleted(): void {
  try {
    window.localStorage.setItem(TOUR_KEY, "true");
  } catch {
    // Ignore — private browsing or storage quota exceeded
  }
}

export function clearTourCompleted(): void {
  try {
    window.localStorage.removeItem(TOUR_KEY);
  } catch {
    // Ignore
  }
}

const SIDEBAR_STATE_KEY = "cruisekube-tour-sidebar-state";

export function saveSidebarState(isOpen: boolean): void {
  try {
    window.localStorage.setItem(SIDEBAR_STATE_KEY, JSON.stringify(isOpen));
  } catch { /* ignore */ }
}

export function getSavedSidebarState(): boolean | null {
  try {
    const value = window.localStorage.getItem(SIDEBAR_STATE_KEY);
    if (value !== null) return JSON.parse(value);
  } catch { /* ignore */ }
  return null;
}

export function clearSavedSidebarState(): void {
  try {
    window.localStorage.removeItem(SIDEBAR_STATE_KEY);
  } catch { /* ignore */ }
}
