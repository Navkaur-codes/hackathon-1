import { useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { buildGrid, listEntities, type GridCell, type GridView } from '../lib/gridModel'
import { semesterSummary } from '../lib/semester'
import type { SolveResult } from '../solver/best'
import type { CollegeData, Id } from '../types'
import { ClashCourt } from './ClashCourt'
import { TimetableGrid } from './TimetableGrid'
import { VerifiedStamp } from './VerifiedStamp'
import { ViewPicker } from './ViewPicker'

const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })

type Props = { college: CollegeData; result: SolveResult; onBack: () => void }

/** The timetable page for one generated result. */
export function TimetableView({ college, result, onBack }: Props) {
  const [view, setView] = useState<GridView>('section')
  const groups = useMemo(() => listEntities(college, view), [college, view])
  const firstId = groups[0]?.items[0]?.id ?? ''
  const [picked, setPicked] = useState<Record<GridView, Id>>({ section: '', teacher: '', room: '' })
  const entityId = picked[view] || firstId
  const grid = useMemo(() => buildGrid(college, result.timetable, view, entityId), [college, result, view, entityId])
  const sem = semesterSummary(college)
  const [selected, setSelected] = useState<{ cell: GridCell; anchor: HTMLElement } | null>(null)
  const errors = result.preflight.filter((w) => w.level === 'error')
  const unplacedName = (assignmentId: string) => {
    const a = college.assignments.find((x) => x.id === assignmentId)
    const s = college.sections.find((x) => x.id === a?.sectionId)
    const sub = college.subjects.find((x) => x.id === a?.subjectId)
    return `${sub?.name ?? assignmentId} · ${s?.name ?? ''}`
  }

  return (
    <section className="py-8">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-ink"
      >
        <ArrowLeft size={15} aria-hidden /> All colleges
      </button>

      <header className="mt-4 flex flex-wrap items-end justify-between gap-3 border-b border-rule pb-5">
        <div>
          <span className="font-mono text-[11px] tracking-[0.2em] text-vermilion uppercase">{college.college.code}</span>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">{college.college.name}</h1>
          <p className="mt-1 text-[13px] text-muted">
            {sem.name} · weekly pattern · {shortDate(sem.startDate)} – {shortDate(sem.endDate)} · {sem.teachingDays}{' '}
            teaching days
          </p>
        </div>
      </header>

      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        <VerifiedStamp conflicts={result.conflicts.length} />
        <span className="font-display text-xl font-semibold tabular-nums">
          {result.score.total}
          <span className="text-sm font-normal text-muted"> / 100 quality</span>
        </span>
        <span className="text-[13px] text-muted">
          <span className="text-ink">{result.placedPeriods}</span> periods a week ·{' '}
          <span className="text-ink">{result.semesterHours.toLocaleString('en-IN')}</span> contact hours this semester
        </span>
        <span className="font-mono text-[11px] text-muted">seed {result.bestSeed}</span>
      </div>

      {(result.timetable.unplaced.length > 0 || errors.length > 0) && (
        <div className="mt-4 rounded-lg border border-vermilion/40 bg-vermilion/5 p-4 text-[13px]">
          <p className="font-semibold text-vermilion">
            {result.unplacedPeriods} {result.unplacedPeriods === 1 ? 'period' : 'periods'} could not be placed
          </p>
          <ul className="mt-2 space-y-1.5">
            {result.timetable.unplaced.map((u) => (
              <li key={u.assignmentId}>
                <span className="text-ink">{unplacedName(u.assignmentId)}</span> — {u.reason}{' '}
                <span className="text-muted">Fix: {u.suggestion}</span>
              </li>
            ))}
            {errors.map((w, i) => (
              <li key={`pf${i}`}>
                <span className="text-ink">Pre-flight:</span> {w.message} <span className="text-muted">Fix: {w.suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6">
        <ViewPicker
          view={view}
          entityId={entityId}
          groups={groups}
          onView={setView}
          onEntity={(id) => setPicked((p) => ({ ...p, [view]: id }))}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-semibold">{grid.title}</h2>
          <p className="text-[13px] text-muted">{grid.subtitle}</p>
        </div>
        <span className="font-mono text-[11px] tracking-wider text-muted uppercase">
          {grid.periods} {grid.periods === 1 ? 'period' : 'periods'} a week
        </span>
      </div>

      <div className="mt-3">
        <TimetableGrid grid={grid} onSelect={(cell, anchor) => setSelected({ cell, anchor })} />
        <p className="mt-2 text-[12px] text-muted">Tap any class to see why it is allowed there.</p>
      </div>
      {selected && (
        <ClashCourt
          college={college}
          timetable={result.timetable}
          cell={selected.cell}
          anchor={selected.anchor}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  )
}
