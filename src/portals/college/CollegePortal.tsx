import { useMemo } from 'react'
import { CollegeCard } from '../../components/CollegeCard'
import { describeTimetable, type BestOptions, type SolveResult } from '../../solver/best'
import type { CollegeData } from '../../types'
import { PortalTitle } from '../PortalTitle'
import { DeptStrip } from './DeptStrip'
import { LoanLedger } from './LoanLedger'
import { PublishPanel } from './PublishPanel'
import { SetupView } from './setup/SetupView'
import type { Edit, SetupTab } from './setup/tabs'

type Props = {
  college: CollegeData
  /** A generated timetable — the caller saves it as the college's draft. */
  onResult: (r: SolveResult) => void
  onView: () => void
  /** `overview` = generate & view; `setup` = rooms, teachers, assignments… */
  page: 'overview' | 'setup'
  setupTab: SetupTab
  onPage: (page: 'overview' | 'setup', tab?: SetupTab) => void
  /** Present only when this session may edit the setup (lib/access.ts). */
  edit?: Edit
  canPublish: boolean
  canExport: boolean
  /** Whole-college generate options: the College Admin may use any department's room (allocated for the semester). */
  solveOptions?: BestOptions
}

/** College Admin of one college: set it up, then generate one clash-free timetable for every department. */
export function CollegePortal({ college, onResult, onView, page, setupTab, onPage, edit, canPublish, canExport, solveOptions }: Props) {
  // the stored draft, described against the college as it is now
  const draft = college.draft
  const result = useMemo(() => (draft ? describeTimetable(college, draft) : undefined), [college, draft])
  const open = college.assignments.filter((a) => !a.teacherId).length
  return (
    <section className="py-8">
      <PortalTitle role="collegeAdmin" title={college.college.name}>
        Your college only — set it up, generate one clash-free timetable for every department, then publish it.
      </PortalTitle>

      <div role="tablist" aria-label="College desk" className="mt-5 flex gap-5 border-b border-rule">
        {(
          [
            ['overview', 'Timetable'],
            ['setup', 'Setup'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={page === id}
            onClick={() => onPage(id)}
            className={`-mb-px border-b-2 pb-2 font-display text-base font-semibold transition ${
              page === id ? 'border-vermilion text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {label}
            {id === 'setup' && open > 0 && (
              <span className="ml-2 rounded-full bg-vermilion px-1.5 py-0.5 align-middle font-mono text-[10px] text-paper">{open} to assign</span>
            )}
          </button>
        ))}
      </div>

      {page === 'setup' && edit ? (
        <div className="mt-6">
          <SetupView college={college} tab={setupTab} onTab={(t) => onPage('setup', t)} edit={edit} />
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
            <PublishPanel college={college} canPublish={canPublish} canExport={canExport} edit={edit} />
          </div>
          <div className="mt-4">
            <DeptStrip college={college} />
          </div>
          <div className="mt-4">
            <LoanLedger college={college} />
          </div>
        </div>
      )}
    </section>
  )
}
