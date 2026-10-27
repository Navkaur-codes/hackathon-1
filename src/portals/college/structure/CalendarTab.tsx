import { Chips, NumberField } from '../../../components/fields'
import { setCalendar, setSlotsPerDay, setWorkingDays, WEEKDAY_NAMES } from '../../../lib/edit'
import { periodTimes } from '../../../lib/structure'
import type { CollegeData } from '../../../types'
import { BreakEditor } from '../../../components/BreakEditor'

type Props = { college: CollegeData; edit: (fn: (c: CollegeData) => CollegeData) => void }

const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0]
const h3 = 'font-display text-base font-semibold'

/** Working days, slots and their times, college breaks, teacher lunch window, lab block length. */
export function CalendarTab({ college, edit }: Props) {
  const cal = college.calendar
  const times = periodTimes(cal)
  const toggleDay = (w: number) =>
    edit((c) => setWorkingDays(c, c.calendar.weekdays.includes(w) ? c.calendar.weekdays.filter((x) => x !== w) : [...c.calendar.weekdays, w]))
  const setLength = (i: number, m: number | undefined) =>
    edit((c) => {
      const lengths = Array.from({ length: c.calendar.periodsPerDay }, (_, k) => c.calendar.periodLengths?.[k] ?? c.calendar.periodMinutes)
      lengths[i] = m ?? c.calendar.periodMinutes
      const same = lengths.every((x) => x === c.calendar.periodMinutes)
      return same ? { ...setCalendar(c, {}), calendar: { ...c.calendar, periodLengths: undefined } } : setCalendar(c, { periodLengths: lengths })
    })

  return (
    <div className="space-y-8">
      <section aria-labelledby="days-h">
        <h3 id="days-h" className={h3}>
          Working days
        </h3>
        <p className="mb-2 text-[13px] text-muted">The weekly pattern repeats on these days all semester. At least one.</p>
        <Chips
          label="Working days"
          options={MONDAY_FIRST.map((w) => ({ value: w, label: WEEKDAY_NAMES[w] }))}
          selected={cal.weekdays}
          onToggle={toggleDay}
        />
      </section>

      <section aria-labelledby="slots-h">
        <h3 id="slots-h" className={h3}>
          Slots
        </h3>
        <p className="mb-3 text-[13px] text-muted">
          One shared grid of slots for every department — a break is a slot too. Give a slot its own length (e.g. a 30-minute lunch).
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <NumberField label="Slots a day" value={cal.periodsPerDay} min={1} max={16} onCommit={(n) => edit((c) => setSlotsPerDay(c, n ?? 1))} />
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] tracking-[0.15em] text-muted uppercase">Day starts</span>
            <input
              type="time"
              value={cal.startTime}
              onChange={(e) => e.target.value && edit((c) => setCalendar(c, { startTime: e.target.value }))}
              className="rounded-lg border border-rule bg-paper px-2.5 py-1.5 text-[14px]"
            />
          </label>
          <NumberField label="Slot length (min)" value={cal.periodMinutes} min={5} max={240} onCommit={(n) => edit((c) => setCalendar(c, { periodMinutes: n ?? 50 }))} />
          <NumberField
            label="Lab block (slots)"
            value={cal.labBlockLength}
            min={1}
            max={cal.periodsPerDay}
            onCommit={(n) => edit((c) => setCalendar(c, { labBlockLength: n ?? 2 }))}
          />
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="text-[13px]">
            <thead>
              <tr className="text-left font-mono text-[11px] tracking-wider text-muted uppercase">
                <th className="py-1 pr-4 font-normal">Slot</th>
                <th className="py-1 pr-4 font-normal">Time</th>
                <th className="py-1 pr-4 font-normal">Own length</th>
                <th className="py-1 font-normal">Teacher lunch window</th>
              </tr>
            </thead>
            <tbody>
              {times.map((t) => (
                <tr key={t.index} className="border-t border-rule">
                  <td className="py-1.5 pr-4 font-mono">P{t.index + 1}</td>
                  <td className="py-1.5 pr-4 font-mono whitespace-nowrap">
                    {t.start}–{t.end}
                  </td>
                  <td className="py-1.5 pr-4">
                    <NumberField
                      label={`Length of P${t.index + 1} in minutes (empty = ${cal.periodMinutes})`}
                      hideLabel
                      allowEmpty
                      value={cal.periodLengths?.[t.index] !== undefined && cal.periodLengths[t.index] !== cal.periodMinutes ? cal.periodLengths[t.index] : undefined}
                      min={5}
                      max={240}
                      onCommit={(m) => setLength(t.index, m)}
                    />
                  </td>
                  <td className="py-1.5">
                    <input
                      type="checkbox"
                      aria-label={`P${t.index + 1} is in the teacher lunch window`}
                      checked={cal.lunchWindow.includes(t.index)}
                      onChange={(e) =>
                        edit((c) =>
                          setCalendar(c, {
                            lunchWindow: e.target.checked ? [...c.calendar.lunchWindow, t.index] : c.calendar.lunchWindow.filter((p) => p !== t.index),
                          }),
                        )
                      }
                      className="h-4 w-4 accent-[var(--ink)]"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3">
          <NumberField
            label="Free lunch slots every teacher keeps"
            value={cal.teacherMinFreeInLunchWindow}
            min={0}
            max={cal.lunchWindow.length}
            onCommit={(n) => edit((c) => setCalendar(c, { teacherMinFreeInLunchWindow: n ?? 1 }))}
            hint="Rule H14: on days they teach, a teacher keeps this many lunch-window slots free — so staggered breaks never leave a shared teacher without lunch."
          />
        </div>
      </section>

      <section aria-labelledby="breaks-h">
        <h3 id="breaks-h" className={h3}>
          College breaks
        </h3>
        <p className="mb-3 text-[13px] text-muted">
          The default for every department. A department, year or section can set its own (Departments tab). Lunch can differ by day, or let the solver
          pick one of several slots each day.
        </p>
        <BreakEditor calendar={cal} rules={cal.breaks} onChange={(rules) => edit((c) => setCalendar(c, { breaks: rules ?? [] }))} />
      </section>
    </div>
  )
}
