import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, Printer } from 'lucide-react'
import { buildGrid } from '../lib/gridModel'
import { nowNext } from '../lib/myDay'
import {
  collegeKey,
  deptKey,
  parsePublicPath,
  publicCollege,
  publicDept,
  publicParts,
  publicUrl,
  snapshotCollege,
  tabIds,
  TAB_VIEW,
  type PublicPath,
  type PublicSnapshot,
  type PublicTab,
} from '../lib/publicView'
import { shortDate } from '../lib/semester'
import { NowCard } from '../portals/student/NowTab'
import type { CollegeData } from '../types'
import { TimetableGrid } from './TimetableGrid'
import { VerifiedStamp } from './VerifiedStamp'

type Props = {
  /** Colleges saved in this browser (a link opened on the admin's own device works without a snapshot). */
  colleges: CollegeData[]
  /** The snapshot a public link carries (`?p=…`); null = a broken one, undefined = none. */
  snap: PublicSnapshot | null | undefined
  path: string[]
  onPath: (parts: string[]) => void
}

const TABS: [PublicTab, string][] = [
  ['faculty', 'Faculty'],
  ['class', 'UG / PG classes'],
  ['room', 'Rooms'],
]
const stamp = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
const btn = 'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition'
const eyebrow = 'font-mono text-[11px] tracking-[0.2em] text-muted uppercase'

function Missing({ title, text }: { title: string; text: string }) {
  return (
    <section className="max-w-xl py-16">
      <h1 className="font-display text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-[14px] text-muted">{text}</p>
    </section>
  )
}

/**
 * A department's public timetable (v0.9-d): anyone with the link sees its Faculty, UG / PG classes and rooms from
 * the published version — no sign-in. `#/t/<college>` alone lists the college's departments.
 */
export function PublicTimetable({ colleges, snap, path, onPath }: Props) {
  const where = parsePublicPath(path)
  const fromLink = useMemo(() => (snap ? snapshotCollege(snap) : undefined), [snap])
  const college = fromLink && where && collegeKey(fromLink) === where.college ? fromLink : where ? publicCollege(colleges, where.college) : undefined

  if (snap === null) return <Missing title="This link is broken." text="It may have been cut short when it was copied. Ask for the link again." />
  if (!where || !college)
    return <Missing title="No published timetable here." text="This college has not published a timetable yet, or the link is incomplete. Ask your college for its department link." />

  const go = (p: Omit<PublicPath, 'college'>) => onPath(publicParts({ college: where.college, ...p }))
  const pd = where.dept ? publicDept(college, where.dept) : undefined
  if (where.dept && !pd) return <Missing title="Department not found." text={`${college.college.name} has no department “${where.dept.toUpperCase()}”.`} />

  if (!pd)
    return (
      <section className="py-8">
        <p className={eyebrow}>Public timetables</p>
        <h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">{college.college.name}</h1>
        <p className="mt-1 text-[14px] text-muted">Pick your department.</p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {college.departments.map((d) => (
            <li key={d.id}>
              <button type="button" onClick={() => go({ dept: deptKey(d) })} className="w-full rounded-xl border border-rule bg-card p-4 text-left transition hover:border-ink">
                <span className="font-mono text-[12px] text-muted">{d.code}</span>
                <span className="block font-display text-[16px] font-semibold">{d.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    )

  return <DeptPage key={`${college.college.id}/${pd.dept.id}`} college={college} pd={pd} where={where} go={go} fromLink={!!fromLink} />
}

function DeptPage({
  college,
  pd,
  where,
  go,
  fromLink,
}: {
  college: CollegeData
  pd: NonNullable<ReturnType<typeof publicDept>>
  where: PublicPath
  go: (p: Omit<PublicPath, 'college'>) => void
  fromLink: boolean
}) {
  const pub = college.published!
  const tab = where.tab ?? 'class'
  const ids = tabIds(pd, tab)
  const id = where.id && ids.includes(where.id) ? where.id : ids[0]
  const unknown = !!where.id && !ids.includes(where.id)
  const grid = id ? buildGrid(college, pub.timetable, TAB_VIEW[tab], id) : undefined
  const [copied, setCopied] = useState(false)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(t)
  }, [])
  const live = tab === 'class' && id ? nowNext(college, now, { kind: 'section', id }) : undefined

  const copy = async () => {
    const base = `${window.location.origin}${window.location.pathname}`
    // a page opened from a link copies that link; on the admin's device a fresh one is built from the saved data
    const url = fromLink ? window.location.href : `${publicUrl(base, college, pd.dept)?.split('#')[0]}${window.location.hash}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this link:', url)
    }
  }

  return (
    <section className="py-6 sm:py-8">
      <header className="border-b border-rule pb-4">
        <p className={eyebrow}>Public timetable · read-only</p>
        <h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">{pd.dept.name}</h1>
        <p className="text-[14px] text-muted">{college.college.name}</p>
        <p className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[12px] text-muted">
          <VerifiedStamp conflicts={0} />
          <span>
            {college.semester.name} · {shortDate(college.semester.startDate)} – {shortDate(college.semester.endDate)} · version {pub.version} published {stamp(pub.at)}
          </span>
        </p>
      </header>

      <div role="tablist" aria-label="Timetables" className="no-print mt-4 flex gap-4 overflow-x-auto border-b border-rule [scrollbar-width:none] sm:gap-5">
        {TABS.map(([t, label]) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => go({ dept: where.dept, tab: t })}
            className={`-mb-px shrink-0 border-b-2 pb-2 font-display text-[15px] font-semibold transition sm:text-base ${
              tab === t ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="no-print mt-4 flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="font-mono text-[11px] tracking-[0.15em] text-muted uppercase">{tab === 'faculty' ? 'Teacher' : tab === 'room' ? 'Room' : 'Class'}</span>
          <select
            value={id ?? ''}
            onChange={(e) => go({ dept: where.dept, tab, id: e.target.value })}
            className="max-w-full rounded-lg border border-rule bg-card px-3 py-2 text-[14px]"
          >
            {tab === 'faculty' && pd.faculty.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            {tab === 'room' &&
              pd.rooms.map(({ room, use }) => (
                <option key={room.id} value={room.id}>
                  {room.name} · {room.type}
                  {use === 'shared' ? ' · shared' : use === 'other' ? ' · another department’s' : ''}
                </option>
              ))}
            {tab === 'class' &&
              pd.levels.map((g) =>
                g.programmes.map(({ programme, sections }) => (
                  <optgroup key={programme.id} label={`${g.level} · ${programme.name}`}>
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                )),
              )}
          </select>
        </label>
        <span className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={copy} className={`${btn} border-rule hover:border-ink`}>
            {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />} {copied ? 'Copied' : 'Copy link'}
          </button>
          <button type="button" onClick={() => window.print()} className={`${btn} border-ink hover:bg-ink hover:text-paper`}>
            <Printer size={14} aria-hidden /> Print
          </button>
        </span>
      </div>

      {unknown && <p className="no-print mt-3 text-[13px] text-vermilion">That timetable is not part of {pd.dept.code} — showing the first one instead.</p>}

      {live && <div className="no-print mt-4">{<NowCard live={live} />}</div>}

      {grid ? (
        <div className="mt-4">
          <div className="mb-2">
            <h2 className="font-display text-lg font-semibold">{grid.title}</h2>
            {grid.subtitle && <p className="text-[13px] text-muted">{grid.subtitle}</p>}
          </div>
          <TimetableGrid grid={grid} />
        </div>
      ) : (
        <p className="mt-6 text-[14px] text-muted">Nothing to show here yet.</p>
      )}
      <p className="no-print mt-3 text-[12px] text-muted">
        Same every week of the semester. {fromLink ? 'This link holds the version published when it was made — if the college publishes again, ask for a fresh link.' : ''}
      </p>
    </section>
  )
}
