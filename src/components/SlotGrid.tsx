import { periodTimes, slotKey } from '../lib/structure'
import type { Calendar, SlotKey } from '../types'

type Props = {
  calendar: Calendar
  marked: SlotKey[]
  onToggle: (k: SlotKey) => void
  /** What a marked slot means, e.g. "unavailable" or "blocked". */
  markLabel: string
  label: string
  /** Slots that cannot be toggled here, with why (e.g. college-blocked). */
  locked?: Map<SlotKey, string>
}

/** Days × slots of the college calendar (rule G4); click or press a slot to mark / unmark it. */
export function SlotGrid({ calendar, marked, onToggle, markLabel, label, locked }: Props) {
  const times = periodTimes(calendar)
  const on = new Set(marked)
  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-1" aria-label={label}>
        <thead>
          <tr>
            <th />
            {times.map((t) => (
              <th key={t.index} scope="col" className="px-0.5 font-mono text-[10px] font-normal text-muted" title={`${t.start}–${t.end}`}>
                P{t.index + 1}
                <span className="block text-[9px]">{t.start}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {calendar.days.map((d, day) => (
            <tr key={d}>
              <th scope="row" className="pr-1 text-left font-mono text-[10px] font-normal tracking-wider text-muted uppercase">
                {d}
              </th>
              {times.map((t) => {
                const k = slotKey(day, t.index)
                const why = locked?.get(k)
                const isOn = on.has(k)
                return (
                  <td key={k} className="p-0">
                    <button
                      type="button"
                      disabled={!!why}
                      aria-pressed={isOn}
                      aria-label={`${d} P${t.index + 1} ${t.start}${why ? ` — ${why}` : isOn ? ` — ${markLabel}` : ''}`}
                      title={why ?? (isOn ? markLabel : 'available')}
                      onClick={() => onToggle(k)}
                      className="block h-7 w-8 rounded border transition disabled:cursor-not-allowed sm:w-10"
                      style={
                        why
                          ? { backgroundImage: 'repeating-linear-gradient(135deg, var(--rule) 0 1px, transparent 1px 6px)', borderColor: 'var(--rule)' }
                          : isOn
                            ? { backgroundImage: 'repeating-linear-gradient(135deg, var(--vermilion) 0 1.5px, transparent 1.5px 6px)', borderColor: 'var(--vermilion)' }
                            : { background: 'var(--card)', borderColor: 'var(--rule)' }
                      }
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
