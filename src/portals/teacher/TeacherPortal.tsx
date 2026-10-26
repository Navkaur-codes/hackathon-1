import type { SelfOutcome } from '../../lib/myDay'
import type { CollegeData, Id } from '../../types'
import { PortalTitle } from '../PortalTitle'
import { HoursTab } from './HoursTab'
import { LeaveTab } from './LeaveTab'
import { TodayTab } from './TodayTab'
import { WeekTab } from './WeekTab'
import type { TeacherPage } from './pages'

type Props = {
  college: CollegeData
  teacherId: Id
  page: TeacherPage
  onPage: (p: TeacherPage) => void
  /** Present only when this session is this teacher (lib/access.ts). */
  act?: (fn: (c: CollegeData) => SelfOutcome) => string | null
}

const TABS: [TeacherPage, string][] = [
  ['today', 'Today'],
  ['week', 'My week'],
  ['leave', 'Leave'],
  ['hours', 'Office hours'],
]

/** Teacher desk: today with real dates, the week, load, leave and office hours — published version only. */
export function TeacherPortal({ college, teacherId, page, onPage, act }: Props) {
  const teacher = college.teachers.find((t) => t.id === teacherId)!
  const dept = college.departments.find((d) => d.id === teacher.deptId)
  const pending = college.leaves.filter((l) => l.teacherId === teacherId && l.status === 'pending').length

  return (
    <section className="py-8">
      <div className="no-print">
        <PortalTitle role="teacher" title={teacher.name}>
          {dept ? `${dept.name} · ` : ''}
          {college.college.name}
          {college.published && ` · timetable v${college.published.version}`}
        </PortalTitle>
      </div>

      {!college.published ? (
        <div className="mt-6 max-w-xl rounded-xl border border-rule bg-card p-5">
          <p className="font-display text-base font-semibold">Your college has not published a timetable yet.</p>
          <p className="mt-1 text-[13px] text-muted">
            Teachers see only the published version — never a draft. Your week appears here as soon as the College Admin publishes it.
          </p>
        </div>
      ) : (
        <>
          <div role="tablist" aria-label="Teacher desk" className="no-print mt-5 flex gap-3.5 overflow-x-auto sm:gap-5 border-b border-rule">
            {TABS.map(([id, label]) => (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={page === id}
                onClick={() => onPage(id)}
                className={`-mb-px shrink-0 border-b-2 pb-2 font-display text-[15px] font-semibold sm:text-base transition ${
                  page === id ? 'border-plum text-ink' : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                {label}
                {id === 'leave' && pending > 0 && (
                  <span className="ml-2 rounded-full bg-plum px-1.5 py-0.5 align-middle font-mono text-[10px] text-paper" title={`${pending} waiting for your HOD`}>{pending}</span>
                )}
              </button>
            ))}
          </div>
          <div className="mt-6">
            {page === 'week' ? (
              <WeekTab college={college} teacherId={teacherId} />
            ) : page === 'leave' && act ? (
              <LeaveTab college={college} teacherId={teacherId} act={act} />
            ) : page === 'hours' && act ? (
              <HoursTab college={college} teacherId={teacherId} act={act} />
            ) : (
              <TodayTab college={college} teacherId={teacherId} />
            )}
          </div>
        </>
      )}
    </section>
  )
}
