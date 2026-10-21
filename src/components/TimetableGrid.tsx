import { CELL_INK, subjectColor } from '../lib/colors'
import type { Grid, GridCell } from '../lib/gridModel'

const HATCH = 'repeating-linear-gradient(135deg, var(--rule) 0 1px, transparent 1px 7px)'
const LAB_STRIPES = 'repeating-linear-gradient(135deg, rgba(28,27,25,0.07) 0 2px, transparent 2px 9px)'

type Props = {
  grid: Grid
  /** Called when a class is activated (Clash Court arrives in P0.3-b). */
  onSelect?: (cell: GridCell, el: HTMLElement) => void
}

/** One weekly timetable: days across, slots down, sticky time ruler. Shape comes from the calendar (rule G4). */
export function TimetableGrid({ grid, onSelect }: Props) {
  const D = grid.days.length
  const P = grid.rows.length
  const label = (c: GridCell) =>
    `${grid.days[c.day]} ${grid.rows[c.start].start}–${grid.rows[c.start + c.span - 1].end}: ${c.subject.name}, ${c.detail}`

  return (
    <div className="overflow-x-auto rounded-xl border border-rule bg-card" data-grid>
      <div
        role="table"
        aria-label={`${grid.title} weekly timetable`}
        className="grid"
        style={{
          // columns share the width and text wraps; below this minimum the box scrolls (the page never does)
          minWidth: `calc(4.75rem + ${D} * 8.75rem)`,
          gridTemplateColumns: `4.75rem repeat(${D}, minmax(0, 1fr))`,
          gridTemplateRows: `auto repeat(${P}, minmax(4.4rem, auto))`,
        }}
      >
        {/* header row */}
        <div className="sticky left-0 z-20 border-b border-rule bg-card" />
        {grid.days.map((d, i) => (
          <div
            key={d}
            role="columnheader"
            className="border-b border-l border-rule px-3 py-2 font-mono text-[11px] tracking-[0.2em] text-muted uppercase"
            style={{ gridColumn: i + 2, gridRow: 1 }}
          >
            {d}
          </div>
        ))}

        {/* time ruler */}
        {grid.rows.map((r) => (
          <div
            key={`t${r.index}`}
            role="rowheader"
            className="sticky left-0 z-10 flex flex-col justify-center border-b border-rule bg-card px-2 font-mono text-[11px] leading-tight text-muted"
            style={{
              gridColumn: 1,
              gridRow: r.index + 2,
              boxShadow: grid.view === 'teacher' && r.inLunchWindow ? 'inset 3px 0 0 var(--marigold)' : undefined,
            }}
          >
            <span className="text-ink">P{r.index + 1}</span>
            <span>{r.start}</span>
            <span>{r.end}</span>
          </div>
        ))}

        {/* empty slots (grid lines) */}
        {grid.rows.flatMap((r) =>
          grid.days.map((_, d) => (
            <div
              key={`e${d}-${r.index}`}
              className="border-b border-l border-rule"
              style={{
                gridColumn: d + 2,
                gridRow: r.index + 2,
                background: grid.view === 'teacher' && r.inLunchWindow ? 'color-mix(in srgb, var(--marigold) 7%, transparent)' : undefined,
              }}
            />
          )),
        )}

        {/* breaks & blocked slots */}
        {grid.breaks.map((b) => (
          <div
            key={`b${b.day}-${b.period}`}
            className="flex items-center justify-center border-b border-l border-rule font-mono text-[10px] tracking-[0.18em] text-muted uppercase"
            style={{ gridColumn: b.day + 2, gridRow: b.period + 2, backgroundImage: HATCH }}
          >
            <span className="rounded bg-card px-1.5 py-0.5">{b.label}</span>
          </div>
        ))}

        {/* classes */}
        {grid.cells.map((c) => (
          <button
            key={c.key}
            type="button"
            data-cell={c.key}
            aria-label={label(c)}
            onClick={(e) => onSelect?.(c, e.currentTarget)}
            className="relative m-1 flex flex-col items-start gap-0.5 overflow-hidden rounded-lg px-2.5 py-2 text-left shadow-[0_1px_0_rgba(28,27,25,0.12)] transition hover:-translate-y-px hover:shadow-md focus-visible:outline-2"
            style={{
              gridColumn: c.day + 2,
              gridRow: `${c.start + 2} / span ${c.span}`,
              background: subjectColor(c.subject.code),
              backgroundImage: c.lab ? LAB_STRIPES : undefined,
              color: CELL_INK,
            }}
          >
            <span className="font-mono text-[10px] tracking-wider opacity-70">
              {c.subject.code}
              {c.lab ? ' · LAB' : ''}
            </span>
            <span className="text-[13px] leading-snug font-semibold">{c.subject.name}</span>
            <span className="text-[11px] leading-snug opacity-80">{c.detail}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
