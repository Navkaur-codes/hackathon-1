import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { dayFor, localIso, nowNext, type DayClass, type NowNext } from '../../lib/myDay'
import { periodTimes } from '../../lib/structure'
import type { CollegeData, Id } from '../../types'

type Props = { college: CollegeData; sectionId: Id }

const DAY_MS = 86_400_000
const shift = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
const btn = 'inline-flex items-center gap-1 rounded-full border border-rule px-2.5 py-1.5 text-[13px] font-medium transition hover:border-ink'

function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(t)
  }, [])
  return now
}

const where = (x: DayClass) => [x.teacher?.name ?? 'no teacher', x.room?.name].filter(Boolean).join(' · ')

/** The big card: what is on now and what comes next, in words. */
export function NowCard({ live }: { live: NowNext }) {
  const { now, next, day } = live
  const headline =
    now.kind === 'class'
      ? now.cls.subject.name
      : now.kind === 'break'
        ? now.label
        : now.kind === 'free'
          ? 'Free period'
          : now.kind === 'before'
            ? 'Classes have not started'
            : now.kind === 'after'
              ? 'Done for today'
              : day.status === 'holiday'
                ? `No classes today — ${day.label}`
                : day.status === 'noClass'
                  ? `No regular classes — ${day.label}`
                  : day.status === 'outside'
                    ? 'The semester is not on'
                    : 'No classes today'
  const detail = now.kind === 'class' ? `${where(now.cls)} · until ${now.until}` : now.kind === 'break' ? `until ${now.until}` : null
  return (
    <section aria-label="Now and next" className="overflow-hidden rounded-xl border border-marigold bg-card">
      <div className="bg-marigold/15 p-5">
        <p className="flex items-center gap-1.5 font-mono text-[11px] tracking-[0.15em] uppercase">
          <Clock size={13} aria-hidden /> Now
        </p>
        <p className="mt-1 font-display text-2xl font-semibold">{headline}</p>
        {detail && <p className="text-[14px] text-muted">{detail}</p>}
        {now.kind === 'class' && now.cls.kind !== 'own' && (
          <p className="mt-1 text-[13px] font-medium text-vermilion">
            {now.cls.kind === 'covered' ? `Substitute today — usually ${now.cls.regular?.name}` : `${now.cls.regular?.name} is on leave — no teacher for this class`}
          </p>
        )}
      </div>
      {now.kind !== 'noClasses' && now.kind !== 'after' && (
        <div className="border-t border-marigold/40 p-5">
          <p className="font-mono text-[11px] tracking-[0.15em] text-muted uppercase">Next</p>
          {next ? (
            <p className="text-[15px]">
              <span className="font-mono text-[13px]">{next.start}</span> · <span className="font-medium">{next.subject.name}</span> · {where(next)}
            </p>
          ) : (
            <p className="text-[15px]">Nothing more today</p>
          )}
        </div>
      )}
    </section>
  )
}

/** Now / Next (on today) and any date's classes with substitute notices — published version only. */
export function NowTab({ college, sectionId }: Props) {
  const now = useNow()
  const today = localIso(now)
  const [date, setDate] = useState(today)
  const who = { kind: 'section', id: sectionId } as const
  const live = nowNext(college, now, who)!
  const day = dayFor(college, date, who)!
  const times = periodTimes(college.calendar)
  const notices = day.classes.filter((x) => x.kind !== 'own')
  // classes and breaks in slot order
  const rows = [
    ...day.classes.map((x) => ({ at: x.placement.period, cls: x as DayClass | undefined, label: '' })),
    ...[...day.breaks].map(([p, label]) => ({ at: p, cls: undefined, label })),
  ].sort((a, b) => a.at - b.at)

  return (
    <div className="space-y-6">
      {date === today && <NowCard live={live} />}

      <section aria-labelledby="day-h" className="rounded-xl border border-rule bg-card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="day-h" className="mr-auto font-display text-lg font-semibold">
            {date === today ? 'Today' : longDate(date)}
            {date === today && <span className="ml-2 font-sans text-[13px] font-normal text-muted">{longDate(date)}</span>}
          </h2>
          <button type="button" onClick={() => setDate((d) => shift(d, -1))} className={btn} aria-label="Previous day">
            <ChevronLeft size={14} aria-hidden />
          </button>
          <button type="button" onClick={() => setDate((d) => shift(d, 1))} className={btn} aria-label="Next day">
            <ChevronRight size={14} aria-hidden />
          </button>
          {date !== today && (
            <button type="button" onClick={() => setDate(today)} className={btn}>
              Today
            </button>
          )}
        </div>

        {notices.length > 0 && (
          <ul className="mt-3 space-y-1.5" aria-label="Notices">
            {notices.map((x) => (
              <li key={`${x.placement.assignmentId}-${x.placement.period}`} className="rounded-lg border-l-4 border-vermilion bg-vermilion/5 px-3 py-2 text-[13px]">
                <strong>{x.start}</strong> {x.subject.name}:{' '}
                {x.kind === 'covered' ? `${x.teacher?.name} takes it instead of ${x.regular?.name}.` : `${x.regular?.name} is on leave and no one is free — use the time for self-study.`}
              </li>
            ))}
          </ul>
        )}

        {day.status !== 'teaching' ? (
          <p className={`mt-4 rounded-lg px-3 py-2 text-[14px] ${day.status === 'holiday' ? 'bg-marigold/15' : 'bg-ink/5'}`}>
            {day.status === 'holiday'
              ? `Holiday — ${day.label}. No classes.`
              : day.status === 'noClass'
                ? `${day.label} — no regular classes.`
                : day.status === 'outside'
                  ? 'Outside the semester.'
                  : 'Not a working day.'}
          </p>
        ) : (
          <ol className="mt-3 divide-y divide-rule">
            {rows.map((r) =>
              r.cls ? (
                <li key={`c${r.at}`} className="flex gap-3 py-2.5">
                  <span className="w-12 shrink-0 font-mono text-[12px] text-muted tabular-nums">{r.cls.start}</span>
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium">
                      {r.cls.subject.name}
                      {r.cls.subject.kind === 'lab' && <span className="ml-1 font-mono text-[11px] text-muted uppercase">lab · till {r.cls.end}</span>}
                    </p>
                    <p className={`text-[13px] ${r.cls.kind === 'own' ? 'text-muted' : 'font-medium text-vermilion'}`}>{where(r.cls)}</p>
                  </div>
                </li>
              ) : (
                <li key={`b${r.at}`} className="flex gap-3 py-2 text-[13px] text-muted">
                  <span className="w-12 shrink-0 font-mono text-[12px] tabular-nums">{times[r.at]?.start}</span>
                  <span className="italic">{r.label}</span>
                </li>
              ),
            )}
          </ol>
        )}
      </section>
    </div>
  )
}
