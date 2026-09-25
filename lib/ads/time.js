// Ad schedules are stored in UTC. The DB pool uses `dateStrings: true`, so
// DATETIME columns come back as "YYYY-MM-DD HH:MM:SS" strings.

export function toMysqlUtc(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export function fromMysqlUtc(value) {
  if (!value) return null;
  return `${String(value).replace(" ", "T")}Z`;
}

// Daily stats/caps are bucketed by the business's local day (Pakistan by
// default). Override with ADS_TZ_OFFSET_MINUTES if the site moves.
export function statDate(now = new Date()) {
  const offset = Number(process.env.ADS_TZ_OFFSET_MINUTES ?? 300);
  return new Date(now.getTime() + offset * 60_000).toISOString().slice(0, 10);
}
