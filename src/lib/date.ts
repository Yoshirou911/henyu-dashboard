/** All helpers operate in the viewer's local timezone. */

export const DAY_MS = 24 * 60 * 60 * 1000;

/** "YYYY-MM-DD" for a given date (defaults to now). */
export function dayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Epoch ms at local midnight of the given date. */
export function startOfDay(date: Date | number = new Date()): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfDay(date: Date | number = new Date()): number {
  return startOfDay(date) + DAY_MS - 1;
}

export function addDays(date: Date | number, days: number): number {
  return new Date(date).getTime() + days * DAY_MS;
}

/** Parse a "YYYY-MM-DD" key to local midnight epoch ms. */
export function parseDayKey(key: string): number {
  const [y, m, d] = key.split("-").map((n) => Number.parseInt(n, 10));
  const date = new Date();
  date.setFullYear(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** Whole days from today (local) until the target day key. Can be negative. */
export function daysUntil(targetDayKey: string, from: Date = new Date()): number {
  const diff = parseDayKey(targetDayKey) - startOfDay(from);
  return Math.round(diff / DAY_MS);
}

/** Inclusive list of day keys for the last `count` days ending today. */
export function lastNDays(count: number, end: Date = new Date()): string[] {
  const keys: string[] = [];
  const base = startOfDay(end);
  for (let i = count - 1; i >= 0; i--) {
    keys.push(dayKey(new Date(base - i * DAY_MS)));
  }
  return keys;
}

/** Monday-based ISO week key: "YYYY-Www". */
export function isoWeekKey(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
  return `${d.getUTCFullYear()}-W${week.toString().padStart(2, "0")}`;
}

/** Short human label: "9/9 (火)". */
const WD = ["日", "月", "火", "水", "木", "金", "土"];
export function shortDateLabel(date: Date | number): string {
  const d = new Date(date);
  return `${d.getMonth() + 1}/${d.getDate()} (${WD[d.getDay()]})`;
}

export function monthKey(date: Date | number = new Date()): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
}

/** "2026年9月9日" */
export function longDateLabel(dayKeyStr: string): string {
  const [y, m, d] = dayKeyStr.split("-");
  return `${y}年${Number(m)}月${Number(d)}日`;
}

export function relativeDayLabel(at: number, now: Date = new Date()): string {
  const diff = startOfDay(now) - startOfDay(at);
  const days = Math.round(diff / DAY_MS);
  if (days <= 0) return "今日";
  if (days === 1) return "昨日";
  if (days < 7) return `${days}日前`;
  if (days < 30) return `${Math.floor(days / 7)}週間前`;
  if (days < 365) return `${Math.floor(days / 30)}ヶ月前`;
  return `${Math.floor(days / 365)}年前`;
}
