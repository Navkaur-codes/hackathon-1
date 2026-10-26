import { useMemo, useState } from 'react'
import { CircleAlert } from 'lucide-react'
import { deliveryByProgramme, deptSummary, idleRooms, insightSource, roomUse, sharedLedger, teachableSlots, teacherLoads } from '../../lib/insights'
import { score } from '../../solver/score'
import type { CollegeData, Id } from '../../types'

type Props = { college: CollegeData; onExchangeHint?: boolean }

const PARTS: [keyof ReturnType<typeof score>['parts'], string][] = [
  ['spread', 'Subjects spread over the week'],
  ['sameDay', 'No subject twice a day'],
  ['teacherGaps', 'Few gaps for teachers'],
  ['sectionGaps', 'Few gaps for sections'],
  ['balance', 'Even daily loads'],
  ['ownRooms', 'Own-department rooms'],
  ['lateLabs', 'Labs not at day end'],
]

/** Sequential scale: one hue (plum) from the card colour, 5 steps — magnitude only, never identity. */
const STEPS = [0, 22, 42, 62, 82]
const step = (share: number) => (share <= 0 ? 0 : share <= 0.25 ? 1 : share <= 0.5 ? 2 : share <= 0.75 ? 3 : 4)
const shade = (i: number) => (i === 0 ? 'var(--card)' : `color-mix(in oklab, var(--plum) ${STEPS[i]}%, var(--card))`)
const inkOn = (i: number) => (i >= 3 ? 'var(--paper)' : 'var(--ink)')

const card = 'rounded-xl border border-rule bg-card p-5'
const h2 = 'font-display text-base font-semibold'
const small = 'font-mono text-[11px] tracking-[0.15em] text-muted uppercase'

/** A thin horizontal bar (rounded end), value as text beside it — the text carries the number, the bar the shape. */
function Bar({ value, max, label, warn }: { value: number; max: number; label: string; warn?: boolean }) {
  const pct = max > 0 ? Math.min(1, value / max) : 0
  return (
    <span className="block h-2 overflow-hidden rounded-full bg-rule" role="img" aria-label={label} title={label}>
      <span className="block h-full rounded-full" style={{ width: `${pct * 100}%`, background: warn ? 'var(--vermilion)' : 'var(--plum)' }} />
    </span>
  )
}

/** College dashboard: quality, departments, teacher load, room heatmap, idle rooms, shared-resource ledger, delivery. */
export function Insights({ college, onExchangeHint = true }: Props) {
  const [deptId, setDeptId] = useState<Id | ''>('')
  const data = useMemo(() => {
    const source = insightSource(college)
    if (!source) return undefined
    const tt = source.timetable
    return {
      label: source.label,
      score: score(college, tt),
      depts: deptSummary(college, tt),
      loads: teacherLoads(college, tt),
      rooms: roomUse(college, tt),
      idle: idleRooms(college, tt),
      ledger: sharedLedger(college, tt),
      delivery: deliveryByProgramme(college, tt),
      slots: teachableSlots(college),
    }
  }, [college])
  if (!data) return <p className={`${card} text-[14px]`}>Generate a timetable first — the dashboard reads the published version, or the draft until one is published.</p>

  const code = (id: Id) => (id === 'shared' ? 'Shared' : (college.departments.find((d) => d.id === id)?.code ?? id))
  const loads = data.loads.filter((l) => !deptId || l.teacher.deptId === deptId)
  const rooms = data.rooms.filter((u) => !deptId || u.room.owner === deptId || u.room.owner === 'shared')
  const maxWeek = Math.max(1, ...loads.map((l) => Math.max(l.week, l.teacher.maxPerWeek)))
  const over = data.loads.filter((l) => l.over).length
  const totalUsed = data.rooms.reduce((s, u) => s + u.used, 0)
  const totalTeachable = data.rooms.reduce((s, u) => s + u.teachable, 0)

  return (
    <div className="space-y-6">
      <p className="text-[13px] text-muted">
        Reading the <strong className="text-ink">{data.label}</strong>. Every number is computed from the timetable — nothing is typed in.
      </p>

      {/* headline numbers */}
      <section aria-label="At a glance" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Quality', `${data.score.total}/100`],
          ['Periods a week', String(data.depts.reduce((s, d) => s + d.periods, 0))],
          ['Rooms in use', `${totalTeachable ? Math.round((totalUsed / totalTeachable) * 100) : 0}%`],
          ['Teachers over a limit', String(over)],
        ].map(([k, v]) => (
          <div key={k} className="min-w-0 rounded-xl border border-rule bg-card px-4 py-3 sm:p-5">
            <p className={small}>{k}</p>
            <p className={`mt-1 font-display text-2xl font-semibold tabular-nums sm:text-3xl ${k.startsWith('Teachers') && over > 0 ? 'text-vermilion' : ''}`}>{v}</p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section aria-labelledby="q-h" className={card}>
          <h2 id="q-h" className={h2}>
            Quality, part by part
          </h2>
          <p className="text-[12px] text-muted">The soft rules (S1–S7) behind the {data.score.total}/100. Hard rules are never traded for these.</p>
          <ul className="mt-3 space-y-2">
            {PARTS.map(([k, label]) => {
              const v = Math.round(data.score.parts[k] * 100)
              return (
                <li key={k} className="grid grid-cols-[minmax(0,11rem)_1fr_2.5rem] items-center gap-3 text-[13px]">
                  <span className="truncate" title={label}>
                    {label}
                  </span>
                  <Bar value={v} max={100} label={`${label}: ${v}%`} />
                  <span className="text-right font-mono text-[12px] text-muted tabular-nums">{v}%</span>
                </li>
              )
            })}
          </ul>
        </section>

        <section aria-labelledby="d-h" className={card}>
          <h2 id="d-h" className={h2}>
            Departments
          </h2>
          <div className="overflow-x-auto">
          <table className="mt-2 w-full text-[13px]">
            <thead>
              <tr className={small}>
                <th className="py-1 text-left font-normal">Dept</th>
                <th className="text-right font-normal">Periods</th>
                <th className="text-right font-normal">Not placed</th>
                <th className="text-right font-normal">Clashes</th>
                <th className="text-right font-normal">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {data.depts.map((d) => (
                <tr key={d.deptId}>
                  <td className="py-1.5" title={d.name}>
                    {d.code} <span className="text-[11px] text-muted">· {d.teachers} teachers · {d.sections} sections</span>
                  </td>
                  <td className="text-right tabular-nums">{d.periods}</td>
                  <td className={`text-right tabular-nums ${d.unplaced ? 'text-vermilion' : 'text-muted'}`}>{d.unplaced}</td>
                  <td className={`text-right tabular-nums ${d.clashes ? 'text-vermilion' : 'text-muted'}`}>{d.clashes}</td>
                  <td className="text-right font-mono text-[11px] uppercase">{d.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>
      </div>

      {/* one filter row above the charts it filters */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex max-w-full min-w-0 items-center gap-2 text-[13px]">
          <span className={small}>Department</span>
          <select value={deptId} onChange={(e) => setDeptId(e.target.value)} className="max-w-full min-w-0 rounded-full border border-rule bg-card px-3 py-1 text-[13px]">
            <option value="">All departments</option>
            {college.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} · {d.name}
              </option>
            ))}
          </select>
        </label>
        <span className="text-[12px] text-muted">filters teacher load and rooms below</span>
      </div>

      <section aria-labelledby="l-h" className={card}>
        <h2 id="l-h" className={h2}>
          Teacher load
        </h2>
        <p className="text-[12px] text-muted">Periods a week against each teacher’s weekly limit (the tick). Busiest first.</p>
        <ul className="mt-3 space-y-1.5">
          {loads.map((l) => {
            const label = `${l.teacher.name}: ${l.week} of ${l.teacher.maxPerWeek} periods a week, busiest day ${l.peak} of ${l.teacher.maxPerDay}`
            return (
              <li key={l.teacher.id} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-[13px]">
                <span className="truncate" title={l.teacher.name}>
                  {l.teacher.name} <span className="font-mono text-[10px] text-muted">{code(l.teacher.deptId)}</span>
                </span>
                <span className="relative block" title={label}>
                  <Bar value={l.week} max={maxWeek} label={label} warn={l.over} />
                  <span className="absolute top-[-2px] h-3 w-0.5 bg-ink/60" style={{ left: `${(l.teacher.maxPerWeek / maxWeek) * 100}%` }} aria-hidden />
                </span>
                <span className="flex items-center gap-1 font-mono text-[12px] tabular-nums">
                  {l.over && (
                    <span className="inline-flex items-center gap-0.5 text-vermilion">
                      <CircleAlert size={12} aria-hidden /> over limit
                    </span>
                  )}
                  {!l.over && l.light && <span className="text-muted">light</span>}
                  <span className="text-muted">
                    {l.week}/{l.teacher.maxPerWeek}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section aria-labelledby="r-h" className={`${card} min-w-0`}>
          <h2 id="r-h" className={h2}>
            Room use by day
          </h2>
          <p className="text-[12px] text-muted">Periods used out of {data.slots[0]} a day{data.slots.some((n) => n !== data.slots[0]) ? ' (fewer on days with blocked slots)' : ''}. Darker = busier.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="border-separate border-spacing-0.5 text-[12px]" aria-label="Periods used per room and day">
              <thead>
                <tr>
                  <th />
                  {college.calendar.days.map((d) => (
                    <th key={d} scope="col" className="px-1 font-mono text-[10px] font-normal text-muted uppercase">
                      {d}
                    </th>
                  ))}
                  <th scope="col" className="px-1 text-right font-mono text-[10px] font-normal text-muted uppercase">
                    Week
                  </th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((u) => (
                  <tr key={u.room.id}>
                    <th scope="row" className="pr-2 text-left font-normal whitespace-nowrap">
                      {u.room.name} <span className="font-mono text-[10px] text-muted">{code(u.room.owner)}</span>
                    </th>
                    {u.perDay.map((n, d) => {
                      const i = step(data.slots[d] ? n / data.slots[d] : 0)
                      return (
                        <td
                          key={d}
                          title={`${u.room.name} · ${college.calendar.days[d]}: ${n} of ${data.slots[d]} periods`}
                          className="h-7 min-w-9 rounded text-center font-mono tabular-nums"
                          style={{ background: shade(i), color: inkOn(i), boxShadow: i === 0 ? 'inset 0 0 0 1px var(--rule)' : undefined }}
                        >
                          {n || ''}
                        </td>
                      )
                    })}
                    <td className="pl-2 text-right font-mono text-muted tabular-nums">{Math.round(u.share * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-muted" aria-label="Legend">
            <span>idle</span>
            {STEPS.map((_, i) => (
              <span key={i} className="inline-block h-3 w-5 rounded-sm" style={{ background: shade(i), boxShadow: 'inset 0 0 0 1px var(--rule)' }} />
            ))}
            <span>full day</span>
          </div>
        </section>

        <section aria-labelledby="i-h" className={card}>
          <h2 id="i-h" className={h2}>
            Idle department rooms
          </h2>
          <p className="text-[12px] text-muted">Free most of the week — {onExchangeHint ? 'their HOD can lend them through Room Exchange.' : 'could be lent to other departments.'}</p>
          <ul className="mt-2 divide-y divide-rule text-[13px]">
            {data.idle.map((u) => (
              <li key={u.room.id} className="flex items-baseline justify-between gap-2 py-1.5">
                <span>
                  {u.room.name} <span className="font-mono text-[10px] text-muted">{code(u.room.owner)} · {u.room.type}</span>
                </span>
                <span className="font-mono text-[12px] text-muted tabular-nums">{u.idle} free</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section aria-labelledby="s-h" className={card}>
          <h2 id="s-h" className={h2}>
            Shared-Resource Ledger
          </h2>
          <p className="text-[12px] text-muted">Who uses each shared room, in periods a week.</p>
          {data.ledger.length === 0 ? (
            <p className="mt-2 text-[13px] text-muted">This college has no shared rooms.</p>
          ) : (
            <ul className="mt-3 space-y-4">
              {data.ledger.map((r) => {
                const max = Math.max(1, ...r.byDept.map((d) => d.periods))
                return (
                  <li key={r.room.id} className="text-[13px]">
                    <p className="flex items-baseline justify-between gap-2">
                      <span className="font-medium">{r.room.name}</span>
                      <span className="font-mono text-[11px] text-muted">
                        {r.used} used · {r.idle} idle
                      </span>
                    </p>
                    <ul className="mt-1 space-y-1">
                      {r.byDept.map((d) => (
                        <li key={d.deptId} className="grid grid-cols-[3rem_1fr_2rem] items-center gap-2">
                          <span className="font-mono text-[11px]">{code(d.deptId)}</span>
                          <Bar value={d.periods} max={max} label={`${r.room.name} · ${code(d.deptId)}: ${d.periods} periods a week`} />
                          <span className="text-right font-mono text-[12px] text-muted tabular-nums">{d.periods}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="dl-h" className={card}>
          <h2 id="dl-h" className={h2}>
            Semester delivery
          </h2>
          <p className="text-[12px] text-muted">Per year / programme: periods a week placed of what the curriculum asks, and contact hours over the semester (holidays taken off).</p>
          <table className="mt-2 w-full text-[13px]">
            <thead>
              <tr className={small}>
                <th className="py-1 text-left font-normal">Programme</th>
                <th className="text-right font-normal">Placed</th>
                <th className="text-right font-normal">Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {data.delivery.map((d) => (
                <tr key={d.programmeId}>
                  <td className="py-1.5">{d.name}</td>
                  <td className={`text-right tabular-nums ${d.placed < d.planned ? 'text-vermilion' : ''}`}>
                    {d.placed}/{d.planned}
                  </td>
                  <td className="text-right tabular-nums">{d.hours.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  )
}
