import { useMemo } from 'react'
import { CollegeCard } from '../../components/CollegeCard'
import { describeTimetable, type BestOptions, type SolveResult } from '../../solver/best'
import type { CollegeData } from '../../types'
import { PortalTitle } from '../PortalTitle'
import { DeptStrip } from './DeptStrip'
import { LoanLedger } from './LoanLedger'
import { BookingsPanel } from './BookingsPanel'
import type { BookingOutcome } from '../../lib/bookings'
import { PublishPanel } from './PublishPanel'
import { leaveWaiting } from '../../lib/leave'
import { LeaveDesk } from '../leave/LeaveDesk'
import { ConflictCenter } from './ConflictCenter'
import { Insights } from './Insights'
import { conflictCount, conflictReport } from '../../solver/conflicts'
import { localIso } from '../../lib/myDay'
import type { Id, Placement, User } from '../../types'
import type { AccountActions } from '../../components/AccountsPanel'
import { SetupView } from './setup/SetupView'
import type { Edit, SetupTab } from './setup/tabs'

type Props = {
  college: CollegeData
  /** A generated timetable — the caller saves it as the college's draft. */
  onResult: (r: SolveResult) => void
  onView: () => void
  /** `overview` = generate & view; `setup` = rooms, teachers, assignments… */
  page: 'overview' | 'setup' | 'leave' | 'conflicts' | 'insights'
  setupTab: SetupTab
  onPage: (page: 'overview' | 'setup' | 'leave' | 'conflicts' | 'insights', tab?: SetupTab) => void
  /** Present only when this session may edit the setup (lib/access.ts). */
  edit?: Edit
  canPublish: boolean
  canExport: boolean
  /** Whole-college generate options: the College Admin may use any department's room (allocated for the semester). */
  solveOptions?: BestOptions
  /** Present only when this session may decide shared-room day bookings. */
  actBookings?: (fn: (c: CollegeData) => BookingOutcome) => string | null
  /** Present only when this session may decide leave for the whole college. */
  actLeave?: (fn: (c: CollegeData) => { ok: true; college: CollegeData } | { ok: false; reason: string }) => string | null
  /** People tab: the college's accounts and what this session may do with them (v0.9). */
  people?: { users: User[]; actions: AccountActions }
  /** Conflict Center fixes (existing actions), present only when this session may use them. */
  fixes?: {
    generateDept: (deptId: Id) => Promise<void>
    generateAll: () => Promise<void>
    moveRoom: (placement: Placement, roomId: Id) => string | null
    unlock: (placement: Placement) => string | null
  }
}

/** College Admin of one college: set it up, then generate one clash-free timetable for every department. */
export function CollegePortal({ college, onResult, onView, page, setupTab, onPage, edit, canPublish, canExport, solveOptions, actBookings, actLeave, fixes, people }: Props) {
  const leaveCount = leaveWaiting(college)
  const clashes = useMemo(() => conflictCount(conflictReport(college, localIso(new Date()))), [college])
  // the stored draft, described against the college as it is now
  const draft = college.draft
  const result = useMemo(() => (draft ? describeTimetable(college, draft) : undefined), [college, draft])
  const open = college.assignments.filter((a) => !a.teacherId).length
  return (
    <section className="py-8">
      <PortalTitle role="collegeAdmin" title={college.college.name}>
        Your college only — set it up, generate one clash-free timetable for every department, then publish it.
      </PortalTitle>

      <div role="tablist" aria-label="College desk" className="mt-5 flex gap-4 overflow-x-auto border-b border-rule [scrollbar-width:none] sm:gap-5">
        {(
          [
            ['overview', 'Timetable'],
            ['setup', 'Setup'],
            ['leave', 'Leave'],
            ...(fixes ? ([['conflicts', 'Conflicts']] as const) : []),
            ['insights', 'Insights'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={page === id}
            onClick={() => onPage(id)}
            className={`-mb-px shrink-0 border-b-2 pb-2 font-display text-[15px] font-semibold transition sm:text-base ${
              page === id ? 'border-vermilion text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {label}
            {id === 'conflicts' && clashes > 0 && (
              <span className="ml-2 rounded-full bg-vermilion px-1.5 py-0.5 align-middle font-mono text-[10px] text-paper">{clashes}</span>
            )}
            {id === 'leave' && leaveCount > 0 && (
              <span className="ml-2 rounded-full bg-vermilion px-1.5 py-0.5 align-middle font-mono text-[10px] text-paper">{leaveCount} to decide</span>
            )}
            {id === 'setup' && open > 0 && (
              <span className="ml-2 rounded-full bg-vermilion px-1.5 py-0.5 align-middle font-mono text-[10px] text-paper">{open} to assign</span>
            )}
          </button>
        ))}
      </div>

      {page === 'insights' ? (
        <div className="mt-6">
          <Insights college={college} />
        </div>
      ) : page === 'conflicts' && fixes ? (
        <div className="mt-6 max-w-3xl">
          <ConflictCenter
            college={college}
            onGenerateDept={fixes.generateDept}
            onGenerateAll={fixes.generateAll}
            onMoveRoom={fixes.moveRoom}
            onUnlock={fixes.unlock}
            onLeave={() => onPage('leave')}
          />
        </div>
      ) : page === 'leave' && actLeave ? (
        <div className="mt-6">
          <LeaveDesk college={college} act={actLeave} accent="vermilion" />
        </div>
      ) : page === 'setup' && edit ? (
        <div className="mt-6">
          <SetupView college={college} tab={setupTab} onTab={(t) => onPage('setup', t)} edit={edit} people={people} />
        </div>
      ) : (
        <div className="mt-6 max-w-2xl">
          {open > 0 && (
            <p className="mb-4 rounded-lg border border-vermilion/40 bg-vermilion/5 p-3 text-[13px]">
              {open} {open === 1 ? 'class has' : 'classes have'} no teacher yet — they stay unplaced until you{' '}
              <button type="button" onClick={() => onPage('setup', 'assignments')} className="font-medium underline">
                choose one in Setup
              </button>
              .
            </p>
          )}
          {college.draftStale && (
            <p className="mb-4 rounded-lg border border-vermilion/40 bg-vermilion/5 p-3 text-[13px]">
              The structure or setup changed after this draft was generated — generate again before publishing.
            </p>
          )}
          <CollegeCard data={college} result={result} onResult={onResult} onView={onView} solveOptions={solveOptions} />
          <div className="mt-4">
            <PublishPanel college={college} canPublish={canPublish} canExport={canExport} edit={edit} onConflicts={fixes ? () => onPage('conflicts') : undefined} />
          </div>
          <div className="mt-4">
            <DeptStrip college={college} />
          </div>
          <div className="mt-4">
            <LoanLedger college={college} />
          </div>
          <div className="mt-4">
            <BookingsPanel college={college} act={actBookings} />
          </div>
        </div>
      )}
    </section>
  )
}
