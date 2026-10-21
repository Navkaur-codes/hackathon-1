import { useMemo, useState } from 'react'
import { Clock, Plus, X } from 'lucide-react'
import {
  commonFree,
  freeRooms,
  freeTeachers,
  nextFree,
  nowSlot,
  occupancy,
  weekStrip,
  type EntityKind,
  type RoomUse,
  type SlotState,
} from '../lib/finder'
import { listEntities, type GridView } from '../lib/gridModel'
import { periodTimes, slotKey } from '../lib/structure'
import type { CollegeData, Id, RoomType, SlotKey, Timetable } from '../types'

type Props = {
  college: CollegeData
  timetable: Timetable
  /** Open an entity's weekly grid on the Timetable tab. */
  onOpen: (view: GridView, id: Id) => void
}

const KIND_LABEL: Record<EntityKind, string> = { section: 'Section', teacher: 'Teacher', room: 'Room' }
const ROOM_LABEL: Record<RoomType, string> = { lecture: 'Lecture room', lab: 'Lab', seminar: 'Seminar hall' }
const USE_BADGE: Record<RoomUse, { text: string; color: string }> = {
  own: { text: 'own dept', color: 'var(--plum)' },
  granted: { text: 'granted', color: 'var(--plum)' },
  shared: { text: 'shared', color: 'var(--gold)' },
  dept: { text: 'dept room', color: 'var(--muted)' },
  'needs-grant': { text: 'needs a grant', color: 'var(--vermilion)' },
}
const STATE_LABEL: Record<SlotState, string> = { free: 'free', busy: 'busy', break: 'break', unavailable: 'unavailable' }

const selectCls = 'min-w-0 rounded-full border border-rule bg-card px-3 py-1.5 text-[13px]'
const cardCls = 'rounded-xl border border-rule bg-card p-4'

/** `kind:id` ↔ entity, for one select that lists sections, teachers and rooms together. */
const encode = (kind: EntityKind, id: Id) => `${kind}:${id}`
const decode = (v: string) => {
  const i = v.indexOf(':')
  return { kind: v.slice(0, i) as EntityKind, id: v.slice(i + 1) }
}

/** Compact week: days down, periods across. Free cells can be clicked to ask "who's free then?". */
function MiniWeek({
  college,
  states,
  label,
  onPick,
}: {
  college: CollegeData
  states: (day: number, period: number) => SlotState
  label: string
  onPick: (day: number, period: number) => void
}) {
  const cal = college.calendar
  const times = periodTimes(cal)
  const style = (s: SlotState) =>
    s === 'free'
      ? { background: 'color-mix(in srgb, var(--marigold) 28%, var(--card))', borderColor: 'var(--marigold)' }
      : s === 'busy'
        ? { background: 'color-mix(in srgb, var(--ink) 72%, transparent)', borderColor: 'transparent' }
        : s === 'unavailable'
          ? { backgroundImage: 'repeating-linear-gradient(135deg, var(--vermilion) 0 1px, transparent 1px 6px)', borderColor: 'var(--rule)' }
          : { backgroundImage: 'repeating-linear-gradient(135deg, var(--rule) 0 1px, transparent 1px 6px)', borderColor: 'var(--rule)' }
  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-1" aria-label={label}>
        <thead>
          <tr>
            <th />
            {times.map((t) => (
              <th key={t.index} scope="col" className="px-0.5 font-mono text-[10px] font-normal text-muted">
                P{t.index + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cal.days.map((d, day) => (
            <tr key={d}>
              <th scope="row" className="pr-1 text-left font-mono text-[10px] font-normal tracking-wider text-muted uppercase">
                {d}
              </th>
              {times.map((t) => {
                const s = states(day, t.index)
                const text = `${d} P${t.index + 1} ${t.start}: ${STATE_LABEL[s]}`
                return (
                  <td key={t.index} className="p-0">
                    {s === 'free' ? (
                      <button
                        type="button"
                        title={`${text} — who else is free then?`}
                        aria-label={`${text}. Show who else is free then`}
                        onClick={() => onPick(day, t.index)}
                        className="block h-6 w-7 rounded border transition hover:scale-110 sm:w-9"
                        style={style(s)}
                      />
                    ) : (
                      <span title={text} aria-label={text} role="img" className="block h-6 w-7 rounded border sm:w-9" style={style(s)} />
                    )}
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

function Legend() {
  const items: { s: SlotState; text: string; css: string }[] = [
    { s: 'free', text: 'Free', css: 'color-mix(in srgb, var(--marigold) 28%, var(--card))' },
    { s: 'busy', text: 'Busy', css: 'color-mix(in srgb, var(--ink) 72%, transparent)' },
    { s: 'break', text: 'Break', css: 'repeating-linear-gradient(135deg, var(--rule) 0 1px, transparent 1px 6px)' },
    { s: 'unavailable', text: 'Unavailable', css: 'repeating-linear-gradient(135deg, var(--vermilion) 0 1px, transparent 1px 6px)' },
  ]
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
      {items.map((i) => (
        <li key={i.s} className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-3 w-4 rounded-sm border border-rule" style={{ background: i.css }} /> {i.text}
        </li>
      ))}
    </ul>
  )
}

/** "Who's free?" — free teachers & rooms at a slot, is X free, and common free slots (lib/finder.ts). */
export function WhoIsFree({ college, timetable, onOpen }: Props) {
  const cal = college.calendar
  const times = useMemo(() => periodTimes(cal), [cal])
  const occ = useMemo(() => occupancy(college, timetable), [college, timetable])
  const deptName = useMemo(() => new Map(college.departments.map((d) => [d.id, d.code])), [college])
  const subjects = useMemo(() => {
    const byCode = new Map<string, string>()
    for (const s of college.subjects) if (!byCode.has(s.code)) byCode.set(s.code, s.name)
    return [...byCode].sort(([a], [b]) => a.localeCompare(b))
  }, [college])
  const roomTypes = useMemo(() => [...new Set(college.rooms.map((r) => r.type))], [college])
  const entityGroups = useMemo(
    () =>
      (['section', 'teacher', 'room'] as const).flatMap((kind) =>
        listEntities(college, kind).map((g) => ({ kind, group: `${KIND_LABEL[kind]}s · ${g.group}`, items: g.items })),
      ),
    [college],
  )
  const entityName = (kind: EntityKind, id: Id) =>
    entityGroups.flatMap((g) => (g.kind === kind ? g.items : [])).find((i) => i.id === id)?.label ?? id

  // ── the slot being asked about ──
  const [slot, setSlot] = useState<{ day: number; periods: number[] }>(() => {
    const now = nowSlot(cal, new Date())
    return now ? { day: now.day, periods: [now.period] } : { day: 0, periods: [0] }
  })
  const [nowNote, setNowNote] = useState<string | null>(null)
  const goNow = () => {
    const now = nowSlot(cal, new Date())
    if (now) {
      setSlot({ day: now.day, periods: [now.period] })
      setNowNote(null)
    } else setNowNote('No class is running right now (outside working days or hours) — pick a slot instead.')
  }
  const togglePeriod = (p: number) =>
    setSlot((s) => {
      const has = s.periods.includes(p)
      const periods = has ? s.periods.filter((x) => x !== p) : [...s.periods, p].sort((a, b) => a - b)
      return { ...s, periods: periods.length ? periods : s.periods }
    })
  const pick = (day: number, period: number) => {
    setSlot({ day, periods: [period] })
    setNowNote(null)
    document.getElementById('free-at')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const slotText = `${cal.days[slot.day]} ${slot.periods.map((p) => `P${p + 1}`).join(', ')} · ${times[slot.periods[0]].start}–${
    times[slot.periods[slot.periods.length - 1]].end
  }`

  const [tDept, setTDept] = useState('')
  const [tSubject, setTSubject] = useState('')
  const teachers = useMemo(
    () =>
      freeTeachers(college, occ, slot.day, slot.periods, { deptId: tDept || undefined, subjectCode: tSubject || undefined }).filter(
        (f) => !tDept || f.teacher.deptId === tDept,
      ),
    [college, occ, slot, tDept, tSubject],
  )
  const [rType, setRType] = useState<RoomType | ''>('')
  const [rMin, setRMin] = useState('')
  const [rDept, setRDept] = useState('')
  const rooms = useMemo(
    () =>
      freeRooms(college, occ, slot.day, slot.periods, {
        type: rType || undefined,
        minCapacity: Number(rMin) || undefined,
        forDeptId: rDept || undefined,
      }),
    [college, occ, slot, rType, rMin, rDept],
  )

  // ── is X free? ──
  const firstEntity = entityGroups[0]?.items[0] ? encode(entityGroups[0].kind, entityGroups[0].items[0].id) : ''
  const [one, setOne] = useState(firstEntity)
  const oneEntity = one ? decode(one) : null
  const strip = useMemo(() => {
    if (!one) return null
    const e = decode(one)
    return weekStrip(college, occ, e.kind, e.id)
  }, [college, occ, one])
  const next = strip ? nextFree(strip, { day: slot.day, period: slot.periods[0] }) : null

  // ── common free slot ──
  const [chosen, setChosen] = useState<string[]>([])
  const [adding, setAdding] = useState('')
  const common = useMemo(() => new Set<SlotKey>(commonFree(college, occ, chosen.map(decode))), [college, occ, chosen])
  const commonByDay = cal.days
    .map((d, day) => ({ d, periods: times.filter((t) => common.has(slotKey(day, t.index))).map((t) => `P${t.index + 1}`) }))
    .filter((x) => x.periods.length)

  const entitySelect = (value: string, onChange: (v: string) => void, label: string, placeholder?: string) => (
    <label className="min-w-0">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`${selectCls} w-full sm:w-72`}>
        {placeholder && <option value="">{placeholder}</option>}
        {entityGroups.map((g) => (
          <optgroup key={g.group} label={g.group}>
            {g.items.map((i) => (
              <option key={i.id} value={encode(g.kind, i.id)}>
                {i.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  )

  return (
    <div className="space-y-8">
      {/* ── free at a slot ── */}
      <section id="free-at" aria-labelledby="free-at-h" className="scroll-mt-4">
        <h2 id="free-at-h" className="font-display text-xl font-semibold">
          Free at a time
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label>
            <span className="sr-only">Day</span>
            <select value={slot.day} onChange={(e) => setSlot((s) => ({ ...s, day: Number(e.target.value) }))} className={selectCls}>
              {cal.days.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <div role="group" aria-label="Periods" className="flex flex-wrap gap-1">
            {times.map((t) => {
              const on = slot.periods.includes(t.index)
              return (
                <button
                  key={t.index}
                  type="button"
                  aria-pressed={on}
                  title={`${t.start}–${t.end}`}
                  onClick={() => togglePeriod(t.index)}
                  className={`rounded-full border px-2.5 py-1 font-mono text-[12px] transition ${
                    on ? 'border-ink bg-ink text-paper' : 'border-rule text-ink hover:bg-ink/5'
                  }`}
                >
                  P{t.index + 1}
                </button>
              )
            })}
          </div>
          <button
            type="button"
            onClick={goNow}
            className="inline-flex items-center gap-1.5 rounded-full border border-vermilion px-3 py-1 text-[13px] font-medium text-vermilion transition hover:bg-vermilion hover:text-paper"
          >
            <Clock size={14} aria-hidden /> Now
          </button>
        </div>
        <p className="mt-2 text-[13px] text-muted" aria-live="polite">
          {nowNote ?? (
            <>
              Showing <span className="text-ink">{slotText}</span>
              {slot.periods.length > 1 ? ' — free for all of them' : ''}. Tap more periods to ask about a longer block.
            </>
          )}
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className={cardCls}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-base font-semibold">
                Free teachers <span className="font-sans text-[13px] font-normal text-muted">· {teachers.length}</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                <label>
                  <span className="sr-only">Teacher department</span>
                  <select value={tDept} onChange={(e) => setTDept(e.target.value)} className={selectCls}>
                    <option value="">Any dept</option>
                    {college.departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="sr-only">Teaches subject</span>
                  <select value={tSubject} onChange={(e) => setTSubject(e.target.value)} className={`${selectCls} max-w-[11rem]`}>
                    <option value="">Any subject</option>
                    {subjects.map(([code, name]) => (
                      <option key={code} value={code}>
                        {code} · {name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            {teachers.length === 0 ? (
              <p className="mt-3 text-[13px] text-muted">Nobody matching is free then.</p>
            ) : (
              <ul className="mt-3 divide-y divide-rule">
                {teachers.map((f) => (
                  <li key={f.teacher.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2">
                    <button type="button" onClick={() => onOpen('teacher', f.teacher.id)} className="text-left text-[14px] font-medium hover:underline">
                      {f.teacher.name}
                    </button>
                    <span className="text-[12px] text-muted">
                      {deptName.get(f.teacher.deptId)} · {f.load} {f.load === 1 ? 'period' : 'periods'} that day (max {f.teacher.maxPerDay})
                      {tSubject && f.teachesSubject && (
                        <span className="ml-1.5 rounded-full px-1.5 py-0.5 font-mono text-[10px] text-paper" style={{ background: 'var(--plum)' }}>
                          teaches {tSubject}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={cardCls}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-base font-semibold">
                Free rooms <span className="font-sans text-[13px] font-normal text-muted">· {rooms.length}</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                <label>
                  <span className="sr-only">Room type</span>
                  <select value={rType} onChange={(e) => setRType(e.target.value as RoomType | '')} className={selectCls}>
                    <option value="">Any type</option>
                    {roomTypes.map((t) => (
                      <option key={t} value={t}>
                        {ROOM_LABEL[t]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1 text-[13px] text-muted">
                  ≥
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={rMin}
                    onChange={(e) => setRMin(e.target.value)}
                    placeholder="seats"
                    aria-label="Minimum seats"
                    className="w-20 rounded-full border border-rule bg-card px-3 py-1.5 text-[13px] text-ink"
                  />
                </label>
                <label>
                  <span className="sr-only">Usable by department</span>
                  <select value={rDept} onChange={(e) => setRDept(e.target.value)} className={selectCls}>
                    <option value="">For any dept</option>
                    {college.departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        For {d.code}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            {rooms.length === 0 ? (
              <p className="mt-3 text-[13px] text-muted">No matching room is free then.</p>
            ) : (
              <ul className="mt-3 divide-y divide-rule">
                {rooms.map(({ room, usable }) => (
                  <li key={room.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2">
                    <button type="button" onClick={() => onOpen('room', room.id)} className="text-left text-[14px] font-medium hover:underline">
                      {room.name}
                    </button>
                    <span className="flex items-center gap-1.5 text-[12px] text-muted">
                      {ROOM_LABEL[room.type]} · {room.capacity} seats
                      <span
                        className="rounded-full border px-1.5 py-0.5 font-mono text-[10px]"
                        style={{ color: USE_BADGE[usable].color, borderColor: USE_BADGE[usable].color }}
                      >
                        {USE_BADGE[usable].text}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* ── is X free? ── */}
      <section aria-labelledby="is-free-h" className={cardCls}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="is-free-h" className="font-display text-xl font-semibold">
            Is it free?
          </h2>
          {entitySelect(one, setOne, 'Teacher, room or section')}
        </div>
        {oneEntity && strip && (
          <>
            <p className="mt-2 text-[13px] text-muted">
              {next ? (
                <>
                  Next free from {cal.days[slot.day]} P{slot.periods[0] + 1}:{' '}
                  <span className="font-medium text-ink">
                    {cal.days[next.day]} P{next.period + 1} · {times[next.period].start}
                  </span>
                </>
              ) : (
                'No free slot all week.'
              )}{' '}
              ·{' '}
              <button type="button" onClick={() => onOpen(oneEntity.kind, oneEntity.id)} className="text-ink underline">
                open the full timetable
              </button>
            </p>
            <div className="mt-3">
              <MiniWeek
                college={college}
                states={(d, p) => strip[d][p]}
                label={`Week of ${entityName(oneEntity.kind, oneEntity.id)}`}
                onPick={pick}
              />
            </div>
            <div className="mt-2">
              <Legend />
            </div>
          </>
        )}
      </section>

      {/* ── common free slot ── */}
      <section aria-labelledby="common-h" className={cardCls}>
        <h2 id="common-h" className="font-display text-xl font-semibold">
          Common free slot
        </h2>
        <p className="mt-1 text-[13px] text-muted">
          Add teachers, rooms or sections — for a meeting, an extra class or a practical.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {entitySelect(adding, setAdding, 'Add a teacher, room or section', 'Choose who must be free…')}
          <button
            type="button"
            disabled={!adding || chosen.includes(adding)}
            onClick={() => {
              setChosen((c) => [...c, adding])
              setAdding('')
            }}
            className="inline-flex items-center gap-1 rounded-full border border-ink px-3 py-1.5 text-[13px] font-medium transition hover:bg-ink hover:text-paper disabled:opacity-40"
          >
            <Plus size={14} aria-hidden /> Add
          </button>
        </div>
        {chosen.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Must all be free">
            {chosen.map((v) => {
              const e = decode(v)
              return (
                <li key={v} className="inline-flex items-center gap-1 rounded-full bg-ink/5 py-1 pr-1 pl-3 text-[13px]">
                  <span className="font-mono text-[10px] text-muted uppercase">{KIND_LABEL[e.kind]}</span> {entityName(e.kind, e.id)}
                  <button
                    type="button"
                    aria-label={`Remove ${entityName(e.kind, e.id)}`}
                    onClick={() => setChosen((c) => c.filter((x) => x !== v))}
                    className="rounded-full p-1 text-muted hover:bg-ink/10 hover:text-ink"
                  >
                    <X size={13} aria-hidden />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {chosen.length > 0 && (
          <>
            <p className="mt-3 text-[13px]" aria-live="polite">
              {common.size === 0 ? (
                <span className="text-vermilion">No slot in the week where all {chosen.length} are free.</span>
              ) : (
                <>
                  <span className="font-semibold">{common.size}</span> {common.size === 1 ? 'slot' : 'slots'} where all {chosen.length} are free:{' '}
                  <span className="text-muted">{commonByDay.map((x) => `${x.d} ${x.periods.join(' ')}`).join(' · ')}</span>
                </>
              )}
            </p>
            <div className="mt-3">
              <MiniWeek
                college={college}
                states={(d, p) => (common.has(slotKey(d, p)) ? 'free' : 'busy')}
                label="Common free slots"
                onPick={pick}
              />
            </div>
          </>
        )}
      </section>
    </div>
  )
}
