import { ArrowLeft, CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react'
import { summarizeCollege } from '../../../lib/structure'
import { preflight } from '../../../solver/preflight'
import type { CollegeData } from '../../../types'
import { PortalTitle } from '../../PortalTitle'
import { CalendarTab } from './CalendarTab'
import { DepartmentsTab } from './DepartmentsTab'
import { SemesterTab } from './SemesterTab'
import { SubjectsTab } from './SubjectsTab'
import { BUILDER_TABS, type BuilderTab } from './tabs'

type Props = {
  college: CollegeData
  tab: BuilderTab
  onTab: (t: BuilderTab) => void
  onBack: () => void
  edit: (fn: (c: CollegeData) => CollegeData) => void
}

/** Super Admin shapes one college: calendar, semester, departments, programmes (sections), subjects. */
export function StructureBuilder({ college, tab, onTab, onBack, edit }: Props) {
  const s = summarizeCollege(college)
  const warnings = preflight(college)
  const errors = warnings.filter((w) => w.level === 'error')

  return (
    <section className="py-8">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-ink">
        <ArrowLeft size={15} aria-hidden /> All colleges
      </button>
      <div className="mt-4">
        <PortalTitle role="superAdmin" title={`${college.college.name} — structure`}>
          Every change is saved at once. Sections, subjects and teacher choices stay consistent; the College Admin generates once it looks right.
        </PortalTitle>
      </div>

      <div role="tablist" aria-label="Structure" className="mt-5 flex flex-wrap gap-x-5 gap-y-1 border-b border-rule">
        {BUILDER_TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            id={`stab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="structure-panel"
            onClick={() => onTab(t.id)}
            className={`-mb-px border-b-2 pb-2 font-display text-base font-semibold transition ${
              tab === t.id ? 'border-gold text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div id="structure-panel" role="tabpanel" aria-labelledby={`stab-${tab}`} className="min-w-0">
          {tab === 'calendar' && <CalendarTab college={college} edit={edit} />}
          {tab === 'semester' && <SemesterTab college={college} edit={edit} />}
          {tab === 'departments' && <DepartmentsTab college={college} edit={edit} />}
          {tab === 'subjects' && <SubjectsTab college={college} edit={edit} />}
        </div>

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
            <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.15em] text-muted uppercase">Pre-flight</p>
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
      </div>
    </section>
  )
}
