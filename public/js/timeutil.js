export function diffMinutes(start, end) {
  if (!start || !end) return 0;
  const valid = (value) =>
    typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  if (!valid(start) || !valid(end)) return 0;
  const minute = (value) =>
    Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  return (minute(end) - minute(start) + 1440) % 1440;
}
export function minutesToHM(value) {
  const minutes = Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;
  return `${Math.floor(minutes / 60)}.${String(minutes % 60).padStart(2, "0")}`;
}
export function validateShiftPair(start, end, label = "Turno") {
  if (Boolean(start) !== Boolean(end))
    throw new Error(
      `${label}: indica sia l'orario di ingresso sia quello di uscita.`,
    );
  if (
    start &&
    (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(end))
  ) {
    throw new Error(`${label}: orario non valido.`);
  }
}
