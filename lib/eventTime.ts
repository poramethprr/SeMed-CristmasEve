/**
 * Central event-time utility.
 *
 * All phase checks are evaluated against absolute instants expressed in
 * Thailand time (Asia/Bangkok, UTC+7, no DST), so the result is identical
 * regardless of the client's device timezone.
 */

export const EVENT_TIMEZONE = "Asia/Bangkok" as const;

/** Dec 1, 2026 00:00 (UTC+7) — watering / fertilizing opens. */
export const EVENT_START = new Date("2026-12-01T00:00:00+07:00");
/** Dec 25, 2026 00:00 (UTC+7) — Christmas finale, trees auto-max. */
export const CHRISTMAS_START = new Date("2026-12-25T00:00:00+07:00");

export type EventPhase = "PRE_EVENT" | "GROWING_PHASE" | "CHRISTMAS_DAY";

/** Visual growth ceiling before Christmas Day (fraction 0..1). */
export const GROWTH_CAP_BEFORE_XMAS = 0.85;
/** Number of actions (water + fertilizer) needed to reach the growth cap. */
export const ACTIONS_FOR_CAP = 60;

export const PRE_EVENT_WATER_HINT = "เริ่มรดน้ำได้วันที่ 1 ธ.ค. 2569";

const toMs = (d: Date | number) => (typeof d === "number" ? d : d.getTime());
let runtimeOffset: number | null = null;

/** Dev mode: pretend "now" is the given instant (the clock keeps ticking). null = real time. */
export function setTimeOverride(target: Date | number | null): void {
  runtimeOffset =
    target === null ? null : toMs(target) - Date.now();
}
export const getTimeOverrideActive = () => runtimeOffset !== null;

/**
 * Optional dev/testing override, e.g. NEXT_PUBLIC_EVENT_NOW="2026-12-25T08:00:00+07:00".
 * The env var is ignored in production builds; use Dev mode (setTimeOverride) there.
 */
function devOverride(): number | null {
  if (runtimeOffset !== null) return Date.now() + runtimeOffset;
  if (process.env.NODE_ENV === "production") return null;
  const raw = process.env.NEXT_PUBLIC_EVENT_NOW;
  if (!raw) return null;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Current epoch ms (honours overrides). */
export function nowMs(now?: Date | number): number {
  if (now !== undefined) return typeof now === "number" ? now : now.getTime();
  return devOverride() ?? Date.now();
}

export function getEventPhase(now?: Date | number): EventPhase {
  const t = nowMs(now);
  if (t < EVENT_START.getTime()) return "PRE_EVENT";
  if (t < CHRISTMAS_START.getTime()) return "GROWING_PHASE";
  return "CHRISTMAS_DAY";
}

/** Watering & fertilizing are allowed from Dec 1 onward (incl. Christmas Day). */
export function canWaterOrFertilize(now?: Date | number): boolean {
  return getEventPhase(now) !== "PRE_EVENT";
}

/** Naming, exploring, decorating and wishes are always available. */
export function canDecorate(): boolean {
  return true;
}

/**
 * Visual growth 0..1 for a tree.
 * - CHRISTMAS_DAY: always 1 (auto-max, regardless of counters).
 * - Otherwise: grows with water + fertilizer, capped at 85%.
 *   Fertilizer counts a bit more than water.
 */
export function getGrowth(
  waterCount: number,
  fertilizerCount: number,
  now?: Date | number,
): number {
  if (getEventPhase(now) === "CHRISTMAS_DAY") return 1;
  const effort = Math.max(0, waterCount) + Math.max(0, fertilizerCount) * 1.5;
  const raw = Math.min(1, effort / ACTIONS_FOR_CAP);
  // Small seedling baseline (0.12) so the tree is never invisible.
  const g = 0.12 + raw * (GROWTH_CAP_BEFORE_XMAS - 0.12);
  return Math.min(GROWTH_CAP_BEFORE_XMAS, g);
}

/** Number of foliage tiers (3..7) for a growth value. */
export function getFoliageTiers(growth: number): number {
  return Math.max(3, Math.min(7, 3 + Math.floor(growth * 4.99)));
}

export interface Countdown {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function getCountdown(target: Date, now?: Date | number): Countdown {
  const totalMs = Math.max(0, target.getTime() - nowMs(now));
  const s = Math.floor(totalMs / 1000);
  return {
    totalMs,
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

/** The next milestone to count down to, or null once Christmas has begun. */
export function getNextMilestone(
  now?: Date | number,
): { label: string; target: Date } | null {
  const phase = getEventPhase(now);
  if (phase === "PRE_EVENT")
    return { label: "เริ่มรดน้ำ 1 ธ.ค. 2569", target: EVENT_START };
  if (phase === "GROWING_PHASE")
    return { label: "วันคริสต์มาส 25 ธ.ค. 2569", target: CHRISTMAS_START };
  return null;
}

/** Format an instant in Thailand time, independent of device timezone. */
export function formatBangkok(
  date: Date | number,
  opts: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  },
): string {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: EVENT_TIMEZONE,
    ...opts,
  }).format(date);
}
