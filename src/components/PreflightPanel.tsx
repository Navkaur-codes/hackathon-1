import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react'
import { summarizeCollege } from '../lib/structure'
import { preflight } from '../solver/preflight'
import type { CollegeData } from '../types'

/** Live shape of a college + pre-flight problems with fixes (catches impossible input before anyone generates). */
export function PreflightPanel({ college }: { college: CollegeData }) {
  const s = summarizeCollege(college)
  const warnings = preflight(college)
  const errors = warnings.filter((w) => w.level === 'error')
  return (
    <aside aria-label="Summary and pre-flight" className="space-y-4 lg:sticky lg:top-4 lg:self-start">
      <div className="rounded-xl border border-rule bg-card p-4 text-[13px]">
        <p className="font-mono text-[11px] tracking-[0.15em] text-muted uppercase">Shape</p>
        <p className="mt-1">
          {s.dayRange} · {s.slotsPerDay} slots · <span className="font-mono">{s.hours}</span>
        </p>
        <p className="mt-1">
          {s.departments.length} depts · {s.sections} sections · {s.students} students
        </p>
        <p className="mt-1">
          {s.subjects} subjects · {s.teachers} teachers · {s.rooms} rooms
        </p>
        <p className="mt-1 text-muted">
          {s.semester.teachingDays} teaching days · {s.staggeredBreaks ? 'staggered breaks' : 'one common break'}
        </p>
      </div>
      <div className="rounded-xl border border-rule bg-card p-4" aria-live="polite">
        <p className="font-mono text-[11px] tracking-[0.15em] text-muted uppercase">Pre-flight</p>
        {warnings.length === 0 ? (
          <p className="mt-2 flex items-center gap-2 text-[13px]">
            <CircleCheck size={16} className="text-plum" aria-hidden /> Nothing stands in the way — ready to generate.
          </p>
        ) : (
          <>
            <p className="mt-1 text-[13px]">
              {errors.length} {errors.length === 1 ? 'problem' : 'problems'} · {warnings.length - errors.length} to check
            </p>
            <ul className="mt-2 max-h-[50vh] space-y-2 overflow-y-auto text-[13px]">
              {warnings.map((w, i) => (
                <li key={i} className="flex gap-2">
                  {w.level === 'error' ? (
                    <CircleAlert size={15} className="mt-0.5 shrink-0 text-vermilion" aria-label="Problem" />
                  ) : (
                    <TriangleAlert size={15} className="mt-0.5 shrink-0 text-gold" aria-label="Check" />
                  )}
                  <span>
                    {w.message} <span className="text-muted">Fix: {w.suggestion}</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </aside>
  )
}
