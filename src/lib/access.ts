// Who may see and do what (root CLAUDE.md §2). Every screen asks here — components never check roles inline.
// Until auth (v0.9) the session comes from the role + college switcher; only how it is set will change.

import type { CollegeData, Id, Role, Session } from '../types'

export type Action =
  /** Structure Builder: calendar, departments, programmes, sections count, subjects. */
  | 'editStructure'
  /** Rooms, teachers, availability, assignments, blocked slots. */
  | 'editSetup'
  | 'generate'
  | 'publish'
  | 'export'
  /** The working draft (Super Admin: read-only). */
  | 'viewDraft'
  /** The published version everyone in the college follows. */
  | 'viewPublished'

const COLLEGE_ADMIN: Action[] = ['editSetup', 'generate', 'publish', 'export', 'viewDraft', 'viewPublished']
const SUPER_ADMIN: Action[] = ['editStructure', 'viewDraft', 'viewPublished']

const isActive = (c: CollegeData) => c.college.status === 'active'

/** Colleges this session may see: Super Admin all (read-only status), everyone else only their own active college. */
export function visibleColleges(session: Session | null, colleges: CollegeData[]): CollegeData[] {
  if (!session) return []
  if (session.role === 'superAdmin') return colleges
  return colleges.filter((c) => c.college.id === session.collegeId && isActive(c))
}

/** One college, only if this session may see it (rule G1: scope by college first). */
export function collegeFor(session: Session | null, colleges: CollegeData[], collegeId: Id | undefined): CollegeData | undefined {
  return visibleColleges(session, colleges).find((c) => c.college.id === collegeId)
}

export function can(session: Session | null, action: Action, collegeId: Id | undefined, colleges: CollegeData[]): boolean {
  const college = collegeFor(session, colleges, collegeId)
  if (!session || !college) return false
  if (session.role === 'superAdmin') return SUPER_ADMIN.includes(action)
  if (session.role === 'collegeAdmin') return COLLEGE_ADMIN.includes(action)
  // HOD, teacher and student read the published version only; v0.5 / v0.6 widen this
  return action === 'viewPublished'
}

/** Colleges a role can be switched into (the stand-in for logging in): every active one. */
export function switchableColleges(colleges: CollegeData[]): CollegeData[] {
  return colleges.filter(isActive)
}

/**
 * Session for entering as `role`: keep the current college if still active, else the first active one.
 * Super Admin's session remembers the last college only so switching back lands there; its access ignores it.
 */
export function sessionFor(role: Role, colleges: CollegeData[], current: Session | null): Session {
  if (role === 'superAdmin') return current?.collegeId ? { role, collegeId: current.collegeId } : { role }
  const options = switchableColleges(colleges)
  const keep = options.find((c) => c.college.id === current?.collegeId)
  return { role, collegeId: (keep ?? options[0])?.college.id }
}
