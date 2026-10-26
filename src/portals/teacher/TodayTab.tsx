import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { dayFor, localIso, nowNext, weekLoad, type DayClass, type MyDay } from '../../lib/myDay'
import type { CollegeData, Id } from '../../types'

type Props = { college: CollegeData; teacherId: Id }

const DAY_MS = 86_400_000
const shift = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
const btn = 'inline-flex items-center gap-1 rounded-full border border-rule px-2.5 py-1.5 text-[13px] font-medium transition hover:border-ink'

const TAG: Record<DayClass['kind'], { text: string; color: string } | null> = {
  own: null,
  covered: { text: 'covered', color: 'var(--muted)' },
  duty: { text: 'substitution duty', color: 'var(--plum)' },
  uncovered: { text: 'not covered', color: 'var(--vermilion)' },
}

function banner(day: MyDay): string | null {
  if (day.status === 'holiday') return `Holiday — ${day.label}. No classes.`
  if (day.status === 'noClass') return `${day.label} — no regular classes.`
  if (day.status === 'off') return 'Not a working day.'
  if (day.status === 'outside') return 'Outside the semester.'
  return day.classes.length === 0 ? 'No classes for you this day.' : null
}

/** One minute clock, so Now / Next moves on by itself. */
function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(t)
  }, [])
  return now
}

/** Today (any date of the semester) for a teacher: classes in order, substitution duties, Now / Next, load. */
export function TodayTab({ college, teacherId }: Props) {
  const now = useNow()
  const today = localIso(now)
  const [date, setDate] = useState(today)
  const who = { kind: 'teacher', id: teacherId } as const
  const day = dayFor(college, date, who)!
  const live = date === today ? nowNext(college, now, who) : undefined
  const load = weekLoad(college, teacherId)!
  const note = banner(day)
  const dayLoad = day.day !== null ? load.perDay[day.day] : 0

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section aria-labelledby="today-h" className="min-w-0 rounded-xl border border-rule bg-card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="today-h" className="mr-auto font-display text-lg font-semibold">
            {longDate(date)}
          </h2>
          <button type="button" onClick={() => setDate((d) => shift(d, -1))} className={btn} aria-label="Previous day">
            <ChevronLeft size={14} aria-hidden />
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            aria-label="Date"
            className="rounded-lg border border-rule bg-paper px-2 py-1 text-[13px]"
          />
          <button type="button" onClick={() => setDate((d) => shift(d, 1))} className={btn} aria-label="Next day">
            <ChevronRight size={14} aria-hidden />
          </button>
          {date !== today && (
            <button type="button" onClick={() => setDate(today)} className={btn}>
              Today
            </button>
          )}
        </div>

        {live && live.now.kind !== 'noClasses' && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="Now and next">
            <div className="rounded-lg border border-plum/40 bg-paper p-3">
              <p className="font-mono text-[11px] tracking-[0.15em] text-plum uppercase">Now</p>
              <p className="text-[14px] font-medium">
                {live.now.kind === 'class'
                  ? `${live.now.cls.subject.code} · ${live.now.cls.section.name} · ${live.now.cls.room?.name ?? ''} — until ${live.now.until}`
                  : live.now.kind === 'break'
                    ? `${live.now.label} — until ${live.now.until}`
                    : live.now.kind === 'before'
                      ? 'The day has not started'
                      : live.now.kind === 'after'
                        ? 'Classes are over for today'
                        : 'Free now'}
              </p>
            </div>
            <div className="rounded-lg border border-rule bg-paper p-3">
              <p className="font-mono text-[11px] tracking-[0.15em] text-muted uppercase">Next</p>
              <p className="text-[14px] font-medium">
                {live.next ? `${live.next.start} · ${live.next.subject.code} · ${live.next.section.name} · ${live.next.room?.name ?? ''}` : 'Nothing more today'}
              </p>
            </div>
          </div>
        )}

        {note ? (
          <p className={`mt-4 rounded-lg px-3 py-2 text-[14px] ${day.status === 'holiday' ? 'bg-marigold/15' : 'bg-ink/5'}`}>{note}</p>
        ) : (
          <ol className="mt-4 divide-y divide-rule">
            {day.classes.map((x) => {
              const tag = TAG[x.kind]
              return (
                <li key={`${x.placement.assignmentId}-${x.placement.period}`} className={`flex gap-4 py-3 ${x.kind === 'covered' ? 'opacity-60' : ''}`}>
                  <span className="w-24 shrink-0 font-mono text-[12px] text-muted tabular-nums">
                    {x.start}–{x.end}
                    <span className="block">
                      P{x.placement.period + 1}
                      {x.placement.length > 1 ? `–${x.placement.period + x.placement.length}` : ''}
                    </span>
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium">
                      {x.subject.name} <span className="font-mono text-[12px] text-muted">{x.subject.code}</span>
                      {x.subject.kind === 'lab' && <span className="ml-1 font-mono text-[11px] text-muted uppercase">lab</span>}
                    </p>
                    <p className="text-[13px] text-muted">
                      {x.section.name} · {x.room?.name ?? 'no room'}
                      {x.kind === 'duty' && x.regular && ` · for ${x.regular.name}`}
                      {x.kind === 'covered' && x.teacher && ` · taken by ${x.teacher.name}`}
                    </p>
                    {tag && (
                      <span className="mt-1 inline-block rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase" style={{ color: tag.color, borderColor: tag.color }}>
                        {tag.text}
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </section>

      <section aria-labelledby="load-h" className="rounded-xl border border-rule bg-card p-5">
        <h2 id="load-h" className="font-display text-base font-semibold">
          My load
        </h2>
        <p className="text-[12px] text-muted">
          {load.week} of {load.maxPerWeek} periods a week · at most {load.maxPerDay} a day
        </p>
        <ul className="mt-3 space-y-1.5" aria-label="Periods per day">
          {college.calendar.days.map((d, i) => {
            const n = load.perDay[i]
            const here = day.day === i
            return (
              <li key={d} className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2 text-[13px]">
                <span className={`font-mono text-[11px] uppercase ${here ? 'font-semibold text-ink' : 'text-muted'}`}>{d}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-rule" aria-hidden>
                  <span className="block h-full rounded-full bg-plum" style={{ width: `${Math.min(1, n / Math.max(1, load.maxPerDay)) * 100}%` }} />
                </span>
                <span className="text-right font-mono text-[12px] text-muted tabular-nums">
                  {n}/{load.maxPerDay}
                </span>
              </li>
            )
          })}
        </ul>
        {day.status === 'teaching' && (
          <p className="mt-3 text-[12px] text-muted">
            This day: {dayLoad} {dayLoad === 1 ? 'period' : 'periods'} in the weekly pattern
            {day.classes.some((x) => x.kind === 'duty') && ` + ${day.classes.filter((x) => x.kind === 'duty').reduce((s, x) => s + x.placement.length, 0)} on substitution duty`}.
          </p>
        )}
      </section>
    </div>
  )
}
