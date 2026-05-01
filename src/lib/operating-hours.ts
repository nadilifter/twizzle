type Hours = {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
};

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function formatOperatingHours(hours: Hours[]): string {
  if (!hours || hours.length === 0) return "Hours unavailable";

  const byDay = new Map<number, Hours>();
  for (const h of hours) {
    if (h.dayOfWeek < 0 || h.dayOfWeek > 6) continue;
    if (!byDay.has(h.dayOfWeek)) byDay.set(h.dayOfWeek, h);
  }

  if (byDay.size === 0) return "Hours unavailable";

  if (byDay.size === 7) {
    const first = byDay.get(WEEK_ORDER[0])!;
    const allSame = Array.from(byDay.values()).every(
      (h) => h.openTime === first.openTime && h.closeTime === first.closeTime
    );
    if (allSame) return `Every day ${formatTimeRange(first.openTime, first.closeTime)}`;
  }

  type Group = { days: number[]; openTime: string; closeTime: string };
  const groups: Group[] = [];
  for (let i = 0; i < WEEK_ORDER.length; i++) {
    const day = WEEK_ORDER[i];
    const h = byDay.get(day);
    if (!h) continue;

    const last = groups[groups.length - 1];
    const lastDay = last?.days[last.days.length - 1];
    const contiguous = lastDay !== undefined && WEEK_ORDER.indexOf(lastDay) === i - 1;

    if (last && contiguous && last.openTime === h.openTime && last.closeTime === h.closeTime) {
      last.days.push(day);
    } else {
      groups.push({ days: [day], openTime: h.openTime, closeTime: h.closeTime });
    }
  }

  return groups
    .map((g) => {
      const label =
        g.days.length === 1
          ? DAY_ABBR[g.days[0]]
          : `${DAY_ABBR[g.days[0]]}–${DAY_ABBR[g.days[g.days.length - 1]]}`;
      return `${label} ${formatTimeRange(g.openTime, g.closeTime)}`;
    })
    .join(" · ");
}

function formatTimeRange(openTime: string, closeTime: string): string {
  const open = parseClockTime(openTime);
  const close = parseClockTime(closeTime);
  if (open.period === close.period) {
    return `${open.display}–${close.display} ${open.period}`;
  }
  return `${open.display} ${open.period}–${close.display} ${close.period}`;
}

function parseClockTime(hhmm: string): { display: string; period: "AM" | "PM" } {
  const [hStr, mStr] = (hhmm ?? "").split(":");
  const h = Number.parseInt(hStr, 10);
  const m = Number.parseInt(mStr, 10);
  if (!Number.isFinite(h) || h < 0 || h > 23) {
    return { display: "--:--", period: "AM" };
  }
  const period: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const minuteStr = Number.isFinite(m) ? m.toString().padStart(2, "0") : "00";
  return { display: `${h12}:${minuteStr}`, period };
}
