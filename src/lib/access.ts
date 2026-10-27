// Who may see and do what (root CLAUDE.md §2). Every screen asks here — components never check roles inline.
// Until auth (v0.9) the session comes from the role + college switcher; only how it is set will change.

import type { CollegeData, Id, Role, Session } from '../types'
import { portalOf, type Route } from './route'

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
  /** Decide single-date bookings of shared rooms (owned rooms are decided by their HOD). */
  | 'roomBookings'
  /** Decide every department's leave and unavailability requests (root §2 "all leave"). */
  | 'leave'
  /** The Conflict Center: every clash with its fix (root §2). */
  | 'conflicts'
  /** The college dashboard (loads, room use, shared-resource ledger); Super Admin reads it too. */
  | 'insights'

const COLLEGE_ADMIN: Action[] = ['editSetup', 'generate', 'publish', 'export', 'viewDraft', 'viewPublished', 'roomBookings', 'leave', 'conflicts', 'insights']
const SUPER_ADMIN: Action[] = ['editStructure', 'viewDraft', 'viewPublished', 'insights']
/** An HOD works on the college draft (their own department's part of it) — never publishes. */
const DEPT_ADMIN: Action[] = ['viewDraft', 'viewPublished']

/** What an HOD may do — only for their own department (root §2). */
export type DeptAction =
  /** Teachers of the dept, its sections' names / strength / breaks, subjects of its programmes, rooms it owns, who teaches its sections. */
  | 'editDept'
  /** Generate only this department against the rest of the college (v0.5-b). */
  | 'generateDept'
  /** Mark the department Ready / back to Draft. */
  | 'markReady'
  /** Offer / request / approve / revoke room loans where the dept is owner or borrower (v0.5-c). */
  | 'exchange'
  /** Decide leave (with cover) and unavailability requests of the department's teachers (v0.7-a). */
  | 'leave'

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
  if (session.role === 'deptAdmin') return DEPT_ADMIN.includes(action)
  // teacher and student read the published version only; v0.6 widens this
  return action === 'viewPublished'
}

/** The department an HOD session works on (in its own college), or undefined for every other session. */
export function deptScope(session: Session | null, colleges: CollegeData[]): Id | undefined {
  if (session?.role !== 'deptAdmin') return undefined
  const college = collegeFor(session, colleges, session.collegeId)
  return college?.departments.some((d) => d.id === session.deptId) ? session.deptId : undefined
}

/** The teacher a Teacher session is (in its own college), or undefined for every other session. */
export function teacherScope(session: Session | null, colleges: CollegeData[]): Id | undefined {
  if (session?.role !== 'teacher') return undefined
  const college = collegeFor(session, colleges, session.collegeId)
  return college?.teachers.some((t) => t.id === session.teacherId) ? session.teacherId : undefined
}

/** The section a Student session belongs to (in its own college), or undefined for every other session. */
export function studentScope(session: Session | null, colleges: CollegeData[]): Id | undefined {
  if (session?.role !== 'student') return undefined
  const college = collegeFor(session, colleges, session.collegeId)
  return college?.sections.some((s) => s.id === session.sectionId) ? session.sectionId : undefined
}

/**
 * May this session act on department `deptId`? An HOD only on their own department; the College Admin on any
 * department of their college for edits and department generate (Ready and room loans are the HODs' own).
 */
export function canDept(session: Session | null, action: DeptAction, deptId: Id | undefined, colleges: CollegeData[]): boolean {
  if (!session || !deptId) return false
  const college = collegeFor(session, colleges, session.collegeId)
  if (!college?.departments.some((d) => d.id === deptId)) return false
  if (session.role === 'deptAdmin') return session.deptId === deptId
  if (session.role === 'collegeAdmin') return action === 'editDept' || action === 'generateDept'
  return false
}

/**
 * May this session lock / unlock a class of department `deptId` in the draft? The College Admin any class of their
 * college; an HOD only their own department's (root §2 "lock slots" + department generate).
 */
export function canLock(session: Session | null, deptId: Id | undefined, colleges: CollegeData[]): boolean {
  if (!session || !deptId) return false
  if (session.role === 'collegeAdmin')
    return can(session, 'generate', session.collegeId, colleges) && !!collegeFor(session, colleges, session.collegeId)?.departments.some((d) => d.id === deptId)
  return session.role === 'deptAdmin' && canDept(session, 'generateDept', deptId, colleges)
}

/** Who is asking the Kaal Assistant, and what they may ask about (v0.8; root §2). */
export type AssistantScope =
  | { role: 'student'; collegeId: Id; sectionId: Id; deptId: Id }
  | { role: 'teacher'; collegeId: Id; teacherId: Id; deptId: Id }
  | { role: 'hod'; collegeId: Id; deptId: Id }
  | { role: 'admin'; collegeId: Id }
  | { role: 'super'; collegeId: Id }

/**
 * The assistant's scope for this session in college `collegeId`, or undefined when it may not ask about it.
 * Students: their own section; teachers: their classes and department; HODs: their department; College Admin: the
 * whole college; Super Admin: any college, read-only. Teachers, students and HODs read only the published version.
 */
export function assistantScope(session: Session | null, colleges: CollegeData[], collegeId: Id | undefined): AssistantScope | undefined {
  const college = collegeFor(session, colleges, collegeId)
  if (!session || !college) return undefined
  const cid = college.college.id
  if (session.role === 'superAdmin') return { role: 'super', collegeId: cid }
  if (session.role === 'collegeAdmin') return { role: 'admin', collegeId: cid }
  if (session.role === 'deptAdmin') {
    const deptId = deptScope(session, colleges)
    return deptId ? { role: 'hod', collegeId: cid, deptId } : undefined
  }
  if (session.role === 'teacher') {
    const id = teacherScope(session, colleges)
    const t = college.teachers.find((x) => x.id === id)
    return t ? { role: 'teacher', collegeId: cid, teacherId: t.id, deptId: t.deptId } : undefined
  }
  const sid = studentScope(session, colleges)
  const s = college.sections.find((x) => x.id === sid)
  return s ? { role: 'student', collegeId: cid, sectionId: s.id, deptId: s.deptId } : undefined
}

/**
 * Route protection (v0.9). The landing page, public department timetables (`#/t/…`) and shared links (`?s=…`,
 * handled before routing) are public. A portal
 * needs a signed-in session and is always the session's own portal; the login page sends a signed-in user to
 * their desk.
 */
export function guard(session: Session | null, route: Route): Route {
  if (route.page === 'landing' || route.page === 'public') return route
  if (!session) return route.page === 'login' ? route : { page: 'login', portal: route.portal }
  if (route.page === 'login') return { page: 'portal', portal: portalOf(session.role) }
  return route.portal === portalOf(session.role) ? route : { page: 'portal', portal: portalOf(session.role) }
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
  const college = options.find((c) => c.college.id === current?.collegeId) ?? options[0]
  if (!college) return { role, collegeId: undefined }
  // remember the department across role switches (only an HOD's access uses it); an HOD always has one
  const kept = college.departments.find((d) => d.id === current?.deptId)
  const dept = kept ?? (role === 'deptAdmin' ? college.departments[0] : undefined)
  // the same for the teacher a Teacher session is (stand-in for logging in until v0.9)
  const teacher = college.teachers.find((t) => t.id === current?.teacherId) ?? (role === 'teacher' ? college.teachers[0] : undefined)
  // … and the section (+ name) of a Student session
  const section = college.sections.find((s) => s.id === current?.sectionId) ?? (role === 'student' ? college.sections[0] : undefined)
  return {
    role,
    collegeId: college.college.id,
    ...(dept ? { deptId: dept.id } : {}),
    ...(teacher ? { teacherId: teacher.id } : {}),
    ...(section ? { sectionId: section.id } : {}),
    ...(current?.studentName ? { studentName: current.studentName } : {}),
  }
}
