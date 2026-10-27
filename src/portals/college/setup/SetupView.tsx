import { PreflightPanel } from '../../../components/PreflightPanel'
import type { CollegeData, Id } from '../../../types'
import { SubjectsTab } from '../structure/SubjectsTab'
import { AssignmentsTab } from './AssignmentsTab'
import { BlockedTab } from './BlockedTab'
import { PasteTab } from './PasteTab'
import { RoomsTab } from './RoomsTab'
import { SectionsTab } from './SectionsTab'
import { setupTabsFor, type Edit, type SetupTab } from './tabs'
import { TeachersTab } from './TeachersTab'

type Props = {
  college: CollegeData
  tab: SetupTab
  onTab: (t: SetupTab) => void
  edit: Edit
  /** HOD desk: show and edit only this department (root §2). */
  deptId?: Id
  /** Accent of the active tab: vermilion (College Admin) or terracotta (HOD). */
  accent?: 'vermilion' | 'terracotta'
}

/** Setup: everything the solver needs beyond the structure, with live pre-flight beside it. */
export function SetupView({ college, tab, onTab, edit, deptId, accent = 'vermilion' }: Props) {
  const tabs = setupTabsFor(!!deptId)
  return (
    <div>
      <div role="tablist" aria-label="Setup" className="flex flex-wrap gap-x-5 gap-y-1 border-b border-rule">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            id={`setup-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="setup-panel"
            onClick={() => onTab(t.id)}
            className={`-mb-px border-b-2 pb-2 text-[14px] font-medium transition ${
              tab === t.id ? (accent === 'terracotta' ? 'border-terracotta text-ink' : 'border-vermilion text-ink') : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div id="setup-panel" role="tabpanel" aria-labelledby={`setup-${tab}`} className="min-w-0">
          {tab === 'teachers' && <TeachersTab college={college} edit={edit} deptId={deptId} />}
          {tab === 'assignments' && <AssignmentsTab college={college} edit={edit} deptId={deptId} />}
          {tab === 'subjects' && deptId && <SubjectsTab college={college} edit={edit} deptId={deptId} />}
          {tab === 'rooms' && <RoomsTab college={college} edit={edit} deptId={deptId} />}
          {tab === 'sections' && <SectionsTab college={college} edit={edit} deptId={deptId} />}
          {tab === 'blocked' && !deptId && <BlockedTab college={college} edit={edit} />}
          {tab === 'paste' && <PasteTab college={college} edit={edit} deptId={deptId} />}
        </div>
        <PreflightPanel college={college} />
      </div>
    </div>
  )
}
