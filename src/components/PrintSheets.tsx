import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Printer, X } from 'lucide-react'
import { buildGrid, type Grid } from '../lib/gridModel'
import { semesterSummary, shortDate } from '../lib/semester'
import type { SolveResult } from '../solver/best'
import type { CollegeData, Timetable } from '../types'
import { TimetableGrid } from './TimetableGrid'

type HeaderProps = { college: CollegeData; grid: Grid; result: SolveResult; onScreen?: boolean }

/** Header printed above every timetable page (hidden on screen, except inside the print preview). */
export function PrintHeader({ college, grid, result, onScreen = false }: HeaderProps) {
  const sem = semesterSummary(college)
  return (
    <div className={`mb-3 border-b border-ink pb-2 ${onScreen ? 'block' : 'hidden print:block'}`}>
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-display text-lg font-semibold">
          {grid.title} <span className="text-sm font-normal">— {grid.subtitle}</span>
        </p>
        <p className="font-mono text-[10px]">
          {result.conflicts.length === 0 ? '0 clashes — verified' : `${result.conflicts.length} clashes`} · quality {result.score.total}/100
        </p>
      </div>
      <p className="text-[11px]">
        {college.college.name} · {sem.name} ({shortDate(sem.startDate)} – {shortDate(sem.endDate)}) · weekly pattern · printed{' '}
        {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · Kaalchakra
      </p>
    </div>
  )
}

/** One A4-landscape sheet: 297 × 210 mm at 96 dpi, 10 mm margins — the same page `@page` prints. */
const SHEET_W = 1123
const SHEET_H = 794

function Sheet({ college, grid, result }: { college: CollegeData; grid: Grid; result: SolveResult }) {
  return (
    <div className="print-sheet shrink-0 bg-white shadow-lg" style={{ width: SHEET_W, minHeight: SHEET_H, padding: 38 }}>
      <PrintHeader college={college} grid={grid} result={result} onScreen />
      <TimetableGrid grid={grid} still />
    </div>
  )
}

export type PreviewMode = 'one' | 'all'

type PreviewProps = {
  college: CollegeData
  timetable: Timetable
  result: SolveResult
  /** The timetable currently open on the page. */
  grid: Grid
  mode: PreviewMode
  onMode: (m: PreviewMode) => void
  onPrint: () => void
  onClose: () => void
}

/**
 * Kaalchakra's own print preview: exactly the A4 sheets that will print, before the browser's dialog opens.
 * Some browsers (in-app browsers, the Windows system dialog) show no preview of their own.
 */
export function PrintPreview({ college, timetable, result, grid, mode, onMode, onPrint, onClose }: PreviewProps) {
  const box = useRef<HTMLDivElement>(null)
  const printBtn = useRef<HTMLButtonElement>(null)
  const [scale, setScale] = useState(1)
  const grids = mode === 'all' ? college.sections.map((s) => buildGrid(college, timetable, 'section', s.id)) : [grid]

  // sheets keep their real size and are scaled down to fit the screen
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const fit = () => setScale(Math.min(1, (el.clientWidth - 32) / SHEET_W))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // latest onClose without re-running the focus effect
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    printBtn.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      before?.focus?.()
    }
  }, [])

  return (
    <div role="dialog" aria-modal="true" aria-label="Print preview" className="no-print fixed inset-0 z-50 flex flex-col bg-[#2b2925]">
      <div className="flex flex-wrap items-center gap-3 bg-card px-4 py-3 shadow">
        <p className="font-display text-base font-semibold">Print preview</p>
        <div role="radiogroup" aria-label="What to print" className="inline-flex rounded-full border border-rule p-0.5">
          {(
            [
              ['one', 'This timetable'],
              ['all', `All sections (${college.sections.length})`],
            ] as const
          ).map(([m, text]) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => onMode(m)}
              className={`rounded-full px-3 py-1 text-[13px] font-medium transition ${mode === m ? 'bg-ink text-paper' : 'text-ink hover:bg-ink/5'}`}
            >
              {text}
            </button>
          ))}
        </div>
        <span className="font-mono text-[11px] tracking-wider text-muted uppercase">
          A4 landscape · {grids.length} {grids.length === 1 ? 'page' : 'pages'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            ref={printBtn}
            type="button"
            onClick={onPrint}
            className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:opacity-90"
          >
            Print <Printer size={15} aria-hidden />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close print preview"
            className="rounded-full p-2 text-muted transition hover:bg-ink/5 hover:text-ink"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        <p className="basis-full text-[12px] text-muted">
          This is exactly what prints. In the browser's dialog, pick your printer or <span className="text-ink">Save as PDF</span>.
        </p>
      </div>
      <div ref={box} className="flex-1 overflow-auto py-6">
        <div className="mx-auto flex flex-col items-center gap-6" style={{ width: SHEET_W * scale }}>
          {grids.map((g) => (
            <div key={g.entityId} style={{ width: SHEET_W * scale, height: SHEET_H * scale }} className="overflow-hidden">
              {/* outer box takes the scaled size, inner sheet is scaled (never both on one element) */}
              <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                <Sheet college={college} grid={g} result={result} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
