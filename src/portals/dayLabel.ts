/** '2026-11-02' → 'Mon, 2 Nov' (UTC, so the date never shifts with the viewer's time zone). */
export const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
