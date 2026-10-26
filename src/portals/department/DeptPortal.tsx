import { ArrowRight, CircleCheck, CircleDashed, Eye } from 'lucide-react'
import { bookingsToDecide } from '../../lib/bookings'
import { meetingCounts } from '../../lib/meetings'
import { leaveWaiting } from '../../lib/leave'
import { LeaveDesk } from '../leave/LeaveDesk'
import { readiness, type ReadinessItem } from '../../lib/deptPlan'
import { assignedLoad } from '../../lib/edit'
import type { CollegeData, Id } from '../../types'
import { SetupView } from '../college/setup/SetupView'
import type { Edit, SetupTab } from '../college/setup/tabs'
import { PortalTitle } from '../PortalTitle'
import { DeptGenerate } from './DeptGenerate'
import { ExchangeTab } from './ExchangeTab'
import type { ExchangeOutcome } from '../../lib/exchange'

type Props = {
  college: CollegeData
  deptId: Id
  page: 'overview' | 'setup' | 'exchange' | 'leave'
  setupTab: SetupTab
  onPage: (page: 'overview' | 'setup' | 'exchange' | 'leave', tab?: SetupTab) => void
  /** Present only when this session may edit the department (lib/access.ts). */
  edit?: Edit
  /** Present only when this session may mark the department Ready. */
  onReady?: (ready: boolean) => void
  /** Open the college draft (read-only for an HOD). */
  onView?: () => void
  /** Present only when this session may generate the department (lib/access.ts). */
  onGenerate?: (round: number) => Promise<void>
  /** Present only when this session may use Room Exchange for the department. */
  act?: (fn: (c: CollegeData) => ExchangeOutcome) => string | null
  /** Present only when this session may decide the department's leave (lib/access.ts). */
  actLeave?: (fn: (c: CollegeData) => { ok: true; college: CollegeData } | { ok: false; reason: string }) => string | null
}

const btn = 'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition disabled:opacity-40'

function StatusChip({ ready }: { ready: boolean }) {
  return (
    <span
      className="rounded-full border px-2 py-0.5 align-middle font-mono text-[11px] tracking-wider uppercase"
      style={{ color: ready ? 'var(--plum)' : 'var(--terracotta)', borderColor: ready ? 'var(--plum)' : 'var(--terracotta)' }}
    >
      {ready ? 'Ready' : 'Draft'}
    </span>
  )
}

/** Periods each teacher of the department is given (from the curriculum) against their weekly limit. */
function LoadChart({ college, deptId }: { college: CollegeData; deptId: Id }) {
  const load = assignedLoad(college)
  const teachers = college.teachers.filter((t) => t.deptId === deptId)
  if (teachers.length === 0) return <p className="text-[13px] text-muted">No teachers in this department yet.</p>
  return (
    <ul className="space-y-2" aria-label="Teacher load">
      {teachers.map((t) => {
        const given = load.get(t.id) ?? 0
        const share = Math.min(1, given / Math.max(1, t.maxPerWeek))
        const over = given > t.maxPerWeek
        return (
          <li key={t.id} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-[13px]">
            <span className="truncate" title={t.name}>
              {t.name}
            </span>
            <span className="h-2.5 overflow-hidden rounded-full bg-rule" aria-hidden>
              <span className="block h-full rounded-full" style={{ width: `${share * 100}%`, background: over ? 'var(--vermilion)' : 'var(--terracotta)' }} />
            </span>
            <span className={`font-mono text-[12px] tabular-nums ${over ? 'text-vermilion' : 'text-muted'}`}>
              {given}/{t.maxPerWeek}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/** Meet-a-Teacher for the department's teachers — counts only, never who asked or about what (root §3). */
function MeetingCounts({ college, deptId }: { college: CollegeData; deptId: Id }) {
  const n = meetingCounts(college, deptId)
  return (
    <section aria-labelledby="meet-h" className="rounded-xl border border-rule bg-card p-5">
      <h2 id="meet-h" className="font-display text-base font-semibold">
        Student meetings
      </h2>
      <p className="text-[12px] text-muted">Your teachers’ meeting requests — counts only; each teacher answers their own.</p>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        {(
          [
            ['Waiting', n.pending],
            ['Fixed', n.accepted],
            ['To re-time', n.needsReschedule],
          ] as const
        ).map(([label, v]) => (
          <div key={label} className="rounded-lg bg-paper py-2">
            <dt className="font-mono text-[10px] tracking-wider text-muted uppercase">{label}</dt>
            <dd className="font-display text-xl font-semibold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/** HOD desk: keep one department ready — setup, readiness checklist, Ready status, teacher load. */
export function DeptPortal({ college, deptId, page, setupTab, onPage, edit, onReady, onView, onGenerate, act, actLeave }: Props) {
  const leaveCount = leaveWaiting(college, deptId)
  const waiting =
    college.grants.filter((g) => (g.status === 'requested' && g.fromDeptId === deptId) || (g.status === 'offered' && g.toDeptId === deptId)).length +
    bookingsToDecide(college, deptId).length
  const dept = college.departments.find((d) => d.id === deptId)!
  const check = readiness(college, deptId)
  const isReady = dept.status === 'ready'
  const open = college.assignments.filter((a) => !a.teacherId && college.sections.some((s) => s.id === a.sectionId && s.deptId === deptId)).length
  const fixLink = (item: ReadinessItem) =>
    item.fix === 'assignments' ? (
      <button type="button" onClick={() => onPage('setup', 'assignments')} className="text-[13px] font-medium underline">
        Choose teachers
      </button>
    ) : item.fix === 'setup' ? (
      <button type="button" onClick={() => onPage('setup', 'teachers')} className="text-[13px] font-medium underline">
        Open setup
      </button>
    ) : onGenerate ? (
      <button
        type="button"
        onClick={() => document.getElementById('gen-h')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
        className="text-[13px] font-medium underline"
      >
        Generate my department
      </button>
    ) : (
      <span className="text-[12px] text-muted">The College Admin’s “Generate whole college” places every department.</span>
    )

  return (
    <section className="py-8">
      <PortalTitle role="deptAdmin" title={dept.name}>
        <span className="mr-2">
          <StatusChip ready={isReady} />
        </span>
        {college.college.name} — your department only. Keep it ready; the College Admin generates and publishes the college.
      </PortalTitle>

      <div role="tablist" aria-label="Department desk" className="mt-5 flex gap-5 border-b border-rule">
        {(
          [
            ['overview', 'Overview'],
            ['setup', 'Setup'],
            ['exchange', 'Room Exchange'],
            ['leave', 'Leave'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={page === id}
            onClick={() => onPage(id)}
            className={`-mb-px border-b-2 pb-2 font-display text-base font-semibold transition ${
              page === id ? 'border-terracotta text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {label}
            {id === 'setup' && open > 0 && (
              <span className="ml-2 rounded-full bg-terracotta px-1.5 py-0.5 align-middle font-mono text-[10px] text-paper">{open} to assign</span>
            )}
            {id === 'leave' && leaveCount > 0 && (
              <span className="ml-2 rounded-full bg-terracotta px-1.5 py-0.5 align-middle font-mono text-[10px] text-paper">{leaveCount} to decide</span>
            )}
            {id === 'exchange' && waiting > 0 && (
              <span className="ml-2 rounded-full bg-terracotta px-1.5 py-0.5 align-middle font-mono text-[10px] text-paper">{waiting} waiting</span>
            )}
          </button>
        ))}
      </div>

      {page === 'leave' && actLeave ? (
        <div className="mt-6">
          <LeaveDesk college={college} deptId={deptId} act={actLeave} accent="terracotta" />
        </div>
      ) : page === 'exchange' && act ? (
        <div className="mt-6">
          <ExchangeTab college={college} deptId={deptId} act={act} />
        </div>
      ) : page === 'setup' && edit ? (
        <div className="mt-6">
          <SetupView college={college} tab={setupTab} onTab={(t) => onPage('setup', t)} edit={edit} deptId={deptId} accent="terracotta" />
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-6">
          {onGenerate && <DeptGenerate college={college} deptId={deptId} onGenerate={onGenerate} />}
          <section aria-labelledby="ready-h" className="rounded-xl border border-rule bg-card p-5">
            <h2 id="ready-h" className="font-display text-lg font-semibold">
              Ready to timetable?
            </h2>
            <ul className="mt-3 space-y-3">
              {check.items.map((item) => (
                <li key={item.id} className="flex gap-3">
                  {item.ok ? (
                    <CircleCheck size={18} className="mt-0.5 shrink-0 text-plum" aria-label="Done" />
                  ) : (
                    <CircleDashed size={18} className="mt-0.5 shrink-0 text-terracotta" aria-label="Not yet" />
                  )}
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium">{item.label}</p>
                    <p className="text-[13px] text-muted">{item.detail}</p>
                    {!item.ok && <div className="mt-1">{fixLink(item)}</div>}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-rule pt-4">
              {onReady &&
                (isReady ? (
                  <button type="button" onClick={() => onReady(false)} className={`${btn} border-rule hover:border-ink`}>
                    Back to Draft
                  </button>
                ) : (
                  <button type="button" disabled={!check.ready} onClick={() => onReady(true)} className={`${btn} border-terracotta bg-terracotta text-paper hover:opacity-90`}>
                    Mark Ready <ArrowRight size={14} aria-hidden />
                  </button>
                ))}
              {onView && college.draft && (
                <button type="button" onClick={onView} className={`${btn} border-rule hover:border-ink`}>
                  <Eye size={14} aria-hidden /> View timetable
                </button>
              )}
              <span className="text-[12px] text-muted">
                {isReady
                  ? 'Ready tells the College Admin your department is set. Any change you make sends it back to Draft.'
                  : check.ready
                    ? 'Everything is in place.'
                    : 'Clear the checklist to mark the department Ready.'}
              </span>
            </div>
          </section>
          </div>
          <div className="space-y-6">
          <section aria-labelledby="load-h" className="rounded-xl border border-rule bg-card p-5">
            <h2 id="load-h" className="font-display text-base font-semibold">
              Teacher load
            </h2>
            <p className="mb-3 text-[12px] text-muted">Periods a week given / weekly limit</p>
            <LoadChart college={college} deptId={deptId} />
          </section>
          <MeetingCounts college={college} deptId={deptId} />
          </div>
        </div>
      )}
    </section>
  )
}
