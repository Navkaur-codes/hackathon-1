import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Printer, RotateCcw, Search } from 'lucide-react'
import { matches, type Filters } from '../lib/filters'
import { buildGrid, listEntities, type GridCell, type GridView } from '../lib/gridModel'
import { semesterSummary, shortDate } from '../lib/semester'
import { viewToSearch } from '../lib/viewUrl'
import type { BestOptions, SolveResult } from '../solver/best'
import { runSolver } from '../solver/runSolver'
import type { CollegeData, Id, Placement } from '../types'
import { ClashCourt } from './ClashCourt'
import { CommandPalette, type PaletteChoice } from './CommandPalette'
import { FilterBar } from './FilterBar'
import { PrintHeader, PrintPreview, type PreviewMode } from './PrintSheets'
import { captureGrid } from './gridMotion'
import { TimetableGrid } from './TimetableGrid'
import { VerifiedStamp } from './VerifiedStamp'
import { ViewPicker } from './ViewPicker'
import { WhoIsFree } from './WhoIsFree'
import { Wheel } from './Wheel'

const ATTEMPTS = 20

type Props = {
  college: CollegeData
  result: SolveResult
  onBack: () => void
  /** A regenerated result replaces the current one (kept by the parent). */
  onResult: (r: SolveResult) => void
  /** View, entity and filters to open with (from a shared link). */
  initial?: { view: GridView; entityId: Id; filters: Filters; tab?: 'free' }
  /** No "Generate another" (Super Admin reads, never generates — root §2). */
  readOnly?: boolean
  /** A warning shown above the result, e.g. "this draft is out of date". */
  notice?: string
  /** HOD: pickers list only this department (its sections, teachers, own / shared / lent rooms). */
  scopeDeptId?: Id
  /** Extra solver options for "Generate another" (College Admin: `anyRoom`). */
  solveOptions?: BestOptions
  /** College Admin: move a class to another room from Clash Court. */
  onMoveRoom?: (placement: Placement, roomId: Id) => string | null
}

/** The timetable page for one generated result. */
export function TimetableView({ college, result, onBack, onResult, initial, readOnly = false, notice, scopeDeptId, solveOptions, onMoveRoom }: Props) {
  const [view, setView] = useState<GridView>(initial?.view ?? 'section')
  const groups = useMemo(() => listEntities(college, view, scopeDeptId), [college, view, scopeDeptId])
  const firstId = groups[0]?.items[0]?.id ?? ''
  const [picked, setPicked] = useState<Record<GridView, Id>>(() => ({
    section: '',
    teacher: '',
    room: '',
    ...(initial?.entityId ? { [initial.view]: initial.entityId } : {}),
  }))
  // an unknown id (stale shared link) falls back to the first entity
  const entityId = groups.some((g) => g.items.some((i) => i.id === picked[view])) ? picked[view] : firstId
  const [filters, setFilters] = useState<Filters>(initial?.filters ?? {})
  const [tab, setTab] = useState<'timetable' | 'free'>(initial?.tab === 'free' ? 'free' : 'timetable')
  const [palette, setPalette] = useState(false)
  const grid = useMemo(() => buildGrid(college, result.timetable, view, entityId), [college, result, view, entityId])
  const matching = grid.cells.filter((c) => matches(c, filters)).length

  // view, entity, filters and seed live in the URL, so this exact view can be bookmarked or shared
  useEffect(() => {
    const search = viewToSearch({
      collegeId: college.college.id,
      seed: result.bestSeed,
      view,
      entityId,
      filters,
      ...(tab === 'free' ? { tab } : {}),
    })
    // keep the hash: it holds the portal route
    window.history.replaceState(null, '', `${window.location.pathname}?${search}${window.location.hash}`)
  }, [college, result.bestSeed, view, entityId, filters, tab])

  // Ctrl/⌘+K opens the quick search from anywhere on the page
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const sem = semesterSummary(college)
  const [selected, setSelected] = useState<{ cell: GridCell; anchor: HTMLElement } | null>(null)
  const [busy, setBusy] = useState(false)
  const [round, setRound] = useState(1)
  const [printAll, setPrintAll] = useState(false)
  const [preview, setPreview] = useState<PreviewMode | null>(null)
  const errors = result.preflight.filter((w) => w.level === 'error')
  const unplacedName = (assignmentId: string) => {
    const a = college.assignments.find((x) => x.id === assignmentId)
    const s = college.sections.find((x) => x.id === a?.sectionId)
    const sub = college.subjects.find((x) => x.id === a?.subjectId)
    return `${sub?.name ?? assignmentId} · ${s?.name ?? ''}`
  }

  const changeView = (v: GridView) => {
    captureGrid()
    setView(v)
  }
  const changeEntity = (id: Id) => {
    captureGrid()
    setPicked((p) => ({ ...p, [view]: id }))
  }
  /** Show one section / teacher / room on the Timetable tab (from Who's free? or the palette). */
  const openEntity = (v: GridView, id: Id) => {
    if (tab === 'timetable') captureGrid()
    setTab('timetable')
    setView(v)
    setPicked((p) => ({ ...p, [v]: id }))
    setSelected(null)
    requestAnimationFrame(() => document.getElementById('timetable-tabs')?.scrollIntoView({ block: 'start' }))
  }
  const choose = (c: PaletteChoice) => {
    if (c.kind === 'subject') {
      setTab('timetable')
      setFilters((f) => ({ ...f, subjectCode: c.code }))
    } else openEntity(c.kind, c.id)
  }
  const regenerate = async () => {
    setBusy(true)
    setSelected(null)
    try {
      // a fresh block of seeds → a different, equally valid timetable
      const next = await runSolver(college, { ...solveOptions, attempts: ATTEMPTS, baseSeed: 1 + round * ATTEMPTS })
      captureGrid()
      setRound((r) => r + 1)
      onResult(next)
    } finally {
      setBusy(false)
    }
  }

  // "Print all sections": render every section's grid (print-only), print, then go back to normal.
  useEffect(() => {
    if (!printAll) return
    const done = () => setPrintAll(false)
    window.addEventListener('afterprint', done)
    const frame = requestAnimationFrame(() => window.print())
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('afterprint', done)
    }
  }, [printAll])

  return (
    <section className="py-8 print:py-0">
      <div className={printAll ? 'print:hidden' : ''}>
        <button
          type="button"
          onClick={onBack}
          className="no-print inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-ink"
        >
          <ArrowLeft size={15} aria-hidden /> All colleges
        </button>

        <header className="no-print mt-4 flex flex-wrap items-end justify-between gap-3 border-b border-rule pb-5">
          <div>
            <span className="font-mono text-[11px] tracking-[0.2em] text-vermilion uppercase">{college.college.code}</span>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">{college.college.name}</h1>
            <p className="mt-1 text-[13px] text-muted">
              {sem.name} · weekly pattern · {shortDate(sem.startDate)} – {shortDate(sem.endDate)} · {sem.teachingDays}{' '}
              teaching days
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {readOnly ? (
              <span className="self-center rounded-full border border-rule px-3 py-1 font-mono text-[11px] tracking-wider text-muted uppercase">
                Read-only
              </span>
            ) : (
              <button
                type="button"
                onClick={regenerate}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-full border border-ink px-4 py-2 text-sm font-medium transition hover:bg-ink hover:text-paper disabled:opacity-60"
              >
                {busy ? (
                  <>
                    <Wheel size={16} spokes={8} /> Solving…
                  </>
                ) : (
                  <>
                    Generate another <RotateCcw size={15} aria-hidden />
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                // the finder isn't printable: show the timetable behind the preview
                setTab('timetable')
                setPreview('one')
              }}
              className="inline-flex items-center gap-2 rounded-full border border-ink px-4 py-2 text-sm font-medium transition hover:bg-ink hover:text-paper"
            >
              Print… <Printer size={15} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('timetable')
                setPreview('all')
              }}
              className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:opacity-90"
            >
              Print all sections… <Printer size={15} aria-hidden />
            </button>
          </div>
        </header>

        {notice && (
          <p role="status" className="no-print mt-5 rounded-lg border border-vermilion/40 bg-vermilion/5 p-3 text-[13px]">
            {notice}
          </p>
        )}
        <div className="no-print mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
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
          <div className="no-print mt-4 rounded-lg border border-vermilion/40 bg-vermilion/5 p-4 text-[13px]">
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

        <div
          id="timetable-tabs"
          className="no-print mt-6 flex scroll-mt-4 flex-wrap items-end justify-between gap-3 border-b border-rule"
        >
          <div role="tablist" aria-label="Timetable or finder" className="flex gap-5">
            {(
              [
                ['timetable', 'Timetable'],
                ['free', "Who's free?"],
              ] as const
            ).map(([id, text]) => (
              <button
                key={id}
                id={`tab-${id}`}
                role="tab"
                type="button"
                aria-selected={tab === id}
                aria-controls={`panel-${id}`}
                onClick={() => {
                  setSelected(null)
                  setTab(id)
                }}
                className={`-mb-px border-b-2 pb-2 font-display text-base font-semibold transition ${
                  tab === id ? 'border-vermilion text-ink' : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                {text}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPalette(true)}
            className="mb-2 inline-flex items-center gap-2 rounded-full border border-rule bg-card px-3 py-1.5 text-[13px] text-muted transition hover:border-ink hover:text-ink"
          >
            <Search size={14} aria-hidden /> Jump to…
            <kbd className="rounded border border-rule px-1.5 font-mono text-[10px]">Ctrl K</kbd>
          </button>
        </div>

        {tab === 'free' ? (
          <div id="panel-free" role="tabpanel" aria-labelledby="tab-free" className="no-print mt-6">
            <WhoIsFree college={college} timetable={result.timetable} onOpen={openEntity} />
          </div>
        ) : (
          <div id="panel-timetable" role="tabpanel" aria-labelledby="tab-timetable">
            <div className="no-print mt-6">
              <ViewPicker view={view} entityId={entityId} groups={groups} onView={changeView} onEntity={changeEntity} />
            </div>

            <div className="no-print mt-6 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="font-display text-xl font-semibold">{grid.title}</h2>
                <p className="text-[13px] text-muted">{grid.subtitle}</p>
              </div>
              <span className="font-mono text-[11px] tracking-wider text-muted uppercase">
                {grid.periods} {grid.periods === 1 ? 'period' : 'periods'} a week
              </span>
            </div>

            <div className="mt-3 print:mt-0">
              <PrintHeader college={college} grid={grid} result={result} />
              <div className="no-print mb-3">
                <FilterBar college={college} filters={filters} onChange={setFilters} matching={matching} total={grid.cells.length} />
              </div>
              <TimetableGrid
                grid={grid}
                onSelect={(cell, anchor) => setSelected({ cell, anchor })}
                dimmed={(c) => !matches(c, filters)}
              />
              <p className="no-print mt-2 text-[12px] text-muted">Tap any class to see why it is allowed there.</p>
            </div>
          </div>
        )}
      </div>

      {printAll && (
        <div className="hidden print:block">
          {college.sections.map((s) => {
            const g = buildGrid(college, result.timetable, 'section', s.id)
            return (
              <div key={s.id} className="print-page">
                <PrintHeader college={college} grid={g} result={result} />
                <TimetableGrid grid={g} still />
              </div>
            )
          })}
        </div>
      )}

      {preview && (
        <PrintPreview
          college={college}
          timetable={result.timetable}
          result={result}
          grid={grid}
          mode={preview}
          onMode={setPreview}
          onPrint={() => (preview === 'all' ? setPrintAll(true) : window.print())}
          onClose={() => setPreview(null)}
        />
      )}

      {palette && <CommandPalette college={college} onChoose={choose} onClose={() => setPalette(false)} />}

      {selected && (
        <ClashCourt
          college={college}
          timetable={result.timetable}
          cell={selected.cell}
          anchor={selected.anchor}
          onClose={() => setSelected(null)}
          onMoveRoom={onMoveRoom}
        />
      )}
    </section>
  )
}
