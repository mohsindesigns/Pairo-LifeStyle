/**
 * Date-range helpers for the admin dashboard. Pure functions (no DB), shared by the
 * dashboard page (which builds the window in the viewer's local time) and the
 * /api/admin/dashboard route (which validates it and buckets orders in that timezone).
 */

export const DASHBOARD_RANGES = {
  today: { label: "Today", unit: "hour" },
  "7d": { label: "7 days", unit: "day" },
  "30d": { label: "30 days", unit: "day" },
  year: { label: "This year", unit: "month" },
};

export const BUCKET_UNITS = ["hour", "day", "month"];

// Mongo $dateToString formats, one per bucket unit; keys produced by bucketKeys() must match.
export const BUCKET_FORMATS = { hour: "%Y-%m-%dT%H", day: "%Y-%m-%d", month: "%Y-%m" };

const pad = (n) => String(n).padStart(2, "0");

function keyFor(date, unit) {
  const ymd = `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
  if (unit === "month") return ymd;
  const day = `${ymd}-${pad(date.getDate())}`;
  return unit === "day" ? day : `${day}T${pad(date.getHours())}`;
}

function step(date, unit) {
  const d = new Date(date);
  if (unit === "hour") d.setHours(d.getHours() + 1);
  else if (unit === "day") d.setDate(d.getDate() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

/**
 * Window for a dashboard range, in the local time of `now`. `to` is exclusive and is the
 * end of the current bucket, so today's chart shows the whole day rather than stopping at
 * the current hour. The previous window has the same length and ends where this one starts.
 */
export function getRangeWindow(range, now = new Date()) {
  const def = DASHBOARD_RANGES[range];
  if (!def) throw new Error(`Unknown dashboard range: ${range}`);

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let from;
  let to;
  if (range === "today") {
    from = startOfToday;
    to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  } else if (range === "year") {
    from = new Date(now.getFullYear(), 0, 1);
    to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  } else {
    const days = range === "7d" ? 7 : 30;
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
    to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  }

  const length = to.getTime() - from.getTime();
  return {
    range,
    unit: def.unit,
    from,
    to,
    prevFrom: new Date(from.getTime() - length),
    prevTo: from,
  };
}

/** Every bucket key in [from, to), in order, so empty hours/days/months still get a bar. */
export function bucketKeys({ from, to, unit }) {
  const keys = [];
  for (let d = new Date(from); d < to; d = step(d, unit)) keys.push(keyFor(d, unit));
  return keys;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Short axis label for a bucket key ("3 pm", "Oct 21", "Oct"). */
export function bucketLabel(key, unit) {
  if (unit === "month") return MONTHS[Number(key.slice(5, 7)) - 1];
  if (unit === "day") return `${MONTHS[Number(key.slice(5, 7)) - 1]} ${Number(key.slice(8, 10))}`;
  const h = Number(key.slice(11, 13));
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${h < 12 ? "am" : "pm"}`;
}

/** Percentage change, or null when there is no previous value to compare with. */
export function percentChange(current, previous) {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}
