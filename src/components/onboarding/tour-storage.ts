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
