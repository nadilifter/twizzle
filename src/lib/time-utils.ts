export function sameDay(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10);
}

export function parseMinutes(time: string): number {
  const [hm, period] = time.split(" ");
  const [h, m] = hm.split(":").map(Number);
  const hour = period === "PM" && h !== 12 ? h + 12 : period === "AM" && h === 12 ? 0 : h;
  return hour * 60 + m;
}

export function timesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  return parseMinutes(start1) < parseMinutes(end2) && parseMinutes(start2) < parseMinutes(end1);
}
