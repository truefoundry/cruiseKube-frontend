/**
 * Utilities for disruption window cron expressions.
 * All stored cron is in UTC; UI can show local time via timezone.
 */

/** Day of week for cron: 1 = Monday, 7 = Sunday (cron standard). */
export const CRON_DOW_MON = 1;
export const CRON_DOW_SUN = 7;

/** Convert local time (hour, minute) in a given IANA timezone to UTC (hour, minute). */
export function localToUTC(
  localHour: number,
  localMinute: number,
  timezone: string
): { hour: number; minute: number } {
  const refDate = new Date("2024-01-01T00:00:00.000Z");
  for (let mins = 0; mins < 24 * 60; mins++) {
    const d = new Date(refDate.getTime() + mins * 60 * 1000);
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(d);
    const h = parseInt(parts.find((p) => p.type === "hour")!.value, 10);
    const m = parseInt(parts.find((p) => p.type === "minute")!.value, 10);
    if (h === localHour && m === localMinute) {
      return { hour: d.getUTCHours(), minute: d.getUTCMinutes() };
    }
  }
  return { hour: localHour, minute: localMinute };
}

/** Build cron expression: minute hour * * dayOfWeek (day-of-week 1=Mon..7=Sun). */
export function buildCron(
  minute: number,
  hour: number,
  dayOfWeekList: number[]
): string {
  const days = [...dayOfWeekList].sort((a, b) => a - b);
  const dayPart = days.length === 0 || days.length === 7 ? "*" : days.join(",");
  return `${minute} ${hour} * * ${dayPart}`;
}

/** Parse a simple cron (minute hour * * dow) into minute, hour, dayOfWeek[]. Returns null if not in that form. */
export function parseCron(cron: string): { minute: number; hour: number; days: number[] } | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  if (parts[2] !== "*" || parts[3] !== "*") return null;
  const minute = parseInt(parts[0], 10);
  const hour = parseInt(parts[1], 10);
  if (Number.isNaN(minute) || Number.isNaN(hour)) return null;
  const dayPart = parts[4];
  const days =
    dayPart === "*"
      ? [1, 2, 3, 4, 5, 6, 7]
      : dayPart.split(",").map((d) => parseInt(d.trim(), 10)).filter((d) => d >= 1 && d <= 7);
  return { minute, hour, days };
}

/** Human-readable short label for cron (e.g. "Mon–Fri 9:00 PM"). timezone used only for display note. */
export function humanizeCron(
  cron: string,
  options?: { timezone?: string; use24h?: boolean }
): string {
  const p = parseCron(cron);
  if (!p) return cron;
  const dayStr = formatCronDayString(p.days);
  const timeStr = formatCronTime(p.hour, p.minute, options?.use24h);
  const tzNote = options?.timezone ? ` (${options.timezone})` : "";
  return `${dayStr} at ${timeStr}${tzNote}`;
}

/** Day string for cron days array (1=Mon..7=Sun). */
function formatCronDayString(days: number[]): string {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayLabels = days.map((d) => dayNames[d === 7 ? 0 : d]);
  if (dayLabels.length === 7) return "Every day";
  if (dayLabels.length === 0) return "No days";
  return dayLabels.join(", ");
}

/** Time only, e.g. "3:30 PM". */
function formatCronTime(hour: number, minute: number, use24h?: boolean): string {
  const h = hour;
  const m = minute;
  return use24h
    ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
    : `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/**
 * Human-readable label for a disruption window (start + end cron).
 * When both use the same days, shows "Mon, Tue, …: 3:30 PM – 3:30 AM" for easier reading.
 */
export function humanizeWindow(
  startCron: string,
  endCron: string,
  options?: { timezone?: string; use24h?: boolean }
): string {
  const startP = parseCron(startCron);
  const endP = parseCron(endCron);
  if (!startP || !endP) {
    return `${humanizeCron(startCron, options)} – ${humanizeCron(endCron, options)}`;
  }
  const startSet = [...startP.days].sort((a, b) => a - b).join(",");
  const endSet = [...endP.days].sort((a, b) => a - b).join(",");
  const sameDays = startSet === endSet;
  if (sameDays) {
    const dayStr = formatCronDayString(startP.days);
    const startTime = formatCronTime(startP.hour, startP.minute, options?.use24h);
    const endTime = formatCronTime(endP.hour, endP.minute, options?.use24h);
    const tzNote = options?.timezone ? ` (${options.timezone})` : "";
    return `${dayStr}: ${startTime} – ${endTime}${tzNote}`;
  }
  return `${humanizeCron(startCron, options)} – ${humanizeCron(endCron, options)}`;
}

/** Default timezone: use browser local or Asia/Kolkata. */
export function getDefaultTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  } catch {
    return "Asia/Kolkata";
  }
}

/** Legacy/alias IANA names to omit when the canonical one is present (avoids duplicate entries). */
const TIMEZONE_ALIASES_TO_SKIP = new Set([
  "Asia/Calcutta", // prefer Asia/Kolkata
  "Etc/UTC",       // prefer UTC when we show "UTC" first
]);

/** Popular timezones shown at the top of the list (canonical names only). */
const POPULAR_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Vancouver",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
];

/**
 * Returns a comprehensive, deduplicated list of IANA timezones for the selector.
 * Uses Intl.supportedValuesOf('timeZone') when available; popular ones are listed first.
 */
export function getTimezoneList(): string[] {
  const popularSet = new Set(POPULAR_TIMEZONES);
  const skipSet = new Set(TIMEZONE_ALIASES_TO_SKIP);

  let all: string[] = [];
  try {
    if (typeof Intl.supportedValuesOf === "function") {
      all = Intl.supportedValuesOf("timeZone") as string[];
    }
  } catch {
    // fallback if not supported (very old env)
  }

  if (all.length === 0) {
    return [...POPULAR_TIMEZONES];
  }

  const rest = all
    .filter((tz) => !popularSet.has(tz) && !skipSet.has(tz))
    .sort((a, b) => a.localeCompare(b));

  return [...POPULAR_TIMEZONES, ...rest];
}

/** @deprecated Use getTimezoneList() for a comprehensive, correct list. */
export const COMMON_TIMEZONES = POPULAR_TIMEZONES;
