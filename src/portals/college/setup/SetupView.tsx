import { PreflightPanel } from '../../../components/PreflightPanel'
import type { CollegeData } from '../../../types'
import { AssignmentsTab } from './AssignmentsTab'
import { BlockedTab } from './BlockedTab'
import { PasteTab } from './PasteTab'
import { RoomsTab } from './RoomsTab'
import { SectionsTab } from './SectionsTab'
import { SETUP_TABS, type Edit, type SetupTab } from './tabs'
import { TeachersTab } from './TeachersTab'

type Props = { college: CollegeData; tab: SetupTab; onTab: (t: SetupTab) => void; edit: Edit }

/** College Admin setup: everything the solver needs beyond the structure, with live pre-flight beside it. */
export function SetupView({ college, tab, onTab, edit }: Props) {
  return (
    <div>
      <div role="tablist" aria-label="Setup" className="flex flex-wrap gap-x-5 gap-y-1 border-b border-rule">
        {SETUP_TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            id={`setup-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="setup-panel"
            onClick={() => onTab(t.id)}
            className={`-mb-px border-b-2 pb-2 text-[14px] font-medium transition ${
              tab === t.id ? 'border-vermilion text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div id="setup-panel" role="tabpanel" aria-labelledby={`setup-${tab}`} className="min-w-0">
          {tab === 'teachers' && <TeachersTab college={college} edit={edit} />}
          {tab === 'assignments' && <AssignmentsTab college={college} edit={edit} />}
          {tab === 'rooms' && <RoomsTab college={college} edit={edit} />}
          {tab === 'sections' && <SectionsTab college={college} edit={edit} />}
          {tab === 'blocked' && <BlockedTab college={college} edit={edit} />}
          {tab === 'paste' && <PasteTab college={college} edit={edit} />}
        </div>
        <PreflightPanel college={college} />
      </div>
    </div>
  )
}
