import type { MeetOutcome } from '../../lib/meetings'
import type { CollegeData, Id } from '../../types'
import { MeetTab } from './MeetTab'
import { PortalTitle } from '../PortalTitle'
import { NowTab } from './NowTab'
import { ShareTab } from './ShareTab'
import { WeekTab } from './WeekTab'
import type { StudentPage } from './pages'

type Props = {
  college: CollegeData
  sectionId: Id
  studentName: string
  onName: (name: string) => void
  page: StudentPage
  onPage: (p: StudentPage) => void
  /** Present only when this session is a student of this section (lib/access.ts). */
  act?: (fn: (c: CollegeData) => MeetOutcome) => string | null
}

const TABS: [StudentPage, string][] = [
  ['today', 'Today'],
  ['week', 'Week'],
  ['meet', 'Meet a teacher'],
  ['share', 'Share'],
]

/** Student desk (phone first): Now / Next, today with substitute notices, the week, a share link — published only. */
export function StudentPortal({ college, sectionId, studentName, onName, page, onPage, act }: Props) {
  const section = college.sections.find((s) => s.id === sectionId)!
  const programme = college.programmes.find((p) => p.id === section.programmeId)

  return (
    <section className="py-6 sm:py-8">
      <div className="no-print">
        <PortalTitle role="student" title={studentName.trim() ? `Hi, ${studentName.trim().split(/\s+/)[0]}` : section.name}>
          {section.name} · {programme?.name ?? ''} · {college.college.name}
        </PortalTitle>
        <label className="mt-3 flex max-w-xs items-center gap-2 text-[13px]">
          <span className="shrink-0 text-muted">Your name</span>
          <input
            value={studentName}
            onChange={(e) => onName(e.target.value)}
            placeholder="for meeting requests"
            className="min-w-0 flex-1 rounded-lg border border-rule bg-paper px-2.5 py-1 text-[14px]"
          />
        </label>
      </div>

      {!college.published ? (
        <div className="mt-6 max-w-xl rounded-xl border border-rule bg-card p-5">
          <p className="font-display text-base font-semibold">Your college has not published a timetable yet.</p>
          <p className="mt-1 text-[13px] text-muted">Students see only the published timetable. Check back once the College Admin publishes it.</p>
        </div>
      ) : (
        <>
          <div role="tablist" aria-label="Student desk" className="no-print mt-5 flex gap-4 overflow-x-auto border-b border-rule sm:gap-5">
            {TABS.map(([id, label]) => (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={page === id}
                onClick={() => onPage(id)}
                className={`-mb-px shrink-0 border-b-2 pb-2 font-display text-[15px] font-semibold transition sm:text-base ${
                  page === id ? 'border-marigold text-ink' : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-5">
            {page === 'week' ? (
              <WeekTab college={college} sectionId={sectionId} />
            ) : page === 'meet' && act ? (
              <MeetTab college={college} sectionId={sectionId} studentName={studentName} act={act} />
            ) : page === 'share' ? (
              <ShareTab college={college} sectionId={sectionId} />
            ) : (
              <NowTab college={college} sectionId={sectionId} />
            )}
          </div>
        </>
      )}
    </section>
  )
}
