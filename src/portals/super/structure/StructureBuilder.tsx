import { ArrowLeft } from 'lucide-react'
import { PreflightPanel } from '../../../components/PreflightPanel'
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

        <PreflightPanel college={college} />
      </div>
    </section>
  )
}
