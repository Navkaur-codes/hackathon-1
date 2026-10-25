import { ArrowRight } from 'lucide-react'
import { roleMeta } from '../components/roles'
import type { CollegeData, Role } from '../types'
import { PortalTitle } from './PortalTitle'

const ARRIVES: Partial<Record<Role, string>> = { deptAdmin: 'v0.5', teacher: 'v0.6', student: 'v0.6' }

type Props = { role: Role; college: CollegeData | undefined; onRole: (r: Role) => void }

/** HOD / Teacher / Student desks until their versions land. */
export function ComingSoon({ role, college, onRole }: Props) {
  const meta = roleMeta(role)
  return (
    <section className="py-8">
      <PortalTitle role={role} title={college ? college.college.name : 'No college yet'}>
        {meta.line}
      </PortalTitle>
      <div className="mt-6 max-w-xl rounded-xl border border-rule bg-card p-5">
        <p className="font-display text-base font-semibold">This desk opens in {ARRIVES[role] ?? 'a later version'}.</p>
        <p className="mt-1 text-[13px] text-muted">
          It will show only the published timetable of {college ? college.college.code : 'your college'} — never a draft.
          Meanwhile, the College Admin desk can generate the whole college.
        </p>
        <button
          type="button"
          onClick={() => onRole('collegeAdmin')}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-ink px-3 py-1.5 text-[13px] font-medium transition hover:bg-ink hover:text-paper"
        >
          Switch to College Admin <ArrowRight size={14} aria-hidden />
        </button>
      </div>
    </section>
  )
}
