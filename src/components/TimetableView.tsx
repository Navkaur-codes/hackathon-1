import { useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { buildGrid, listEntities, type GridView } from '../lib/gridModel'
import { semesterSummary } from '../lib/semester'
import type { SolveResult } from '../solver/best'
import type { CollegeData, Id } from '../types'
import { TimetableGrid } from './TimetableGrid'
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
        <TimetableGrid grid={grid} />
      </div>
    </section>
  )
}
