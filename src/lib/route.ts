// Light hash routes (no router library): `#/` landing, `#/<portal>` per role, optionally with a sub-path
// (`#/super/<collegeId>/structure`). Anything that is not `#/…` (e.g. `#colleges`, an in-page anchor)
// counts as the landing page.

import type { Role } from '../types'

export type Portal = 'super' | 'college' | 'dept' | 'teacher' | 'student'
/** `#/login` (optionally `#/login/<portal>` to point at one role's demo accounts). */
export type Route = { page: 'landing' } | { page: 'login'; portal?: Portal } | { page: 'portal'; portal: Portal; path?: string[] }

const PORTAL_OF: Record<Role, Portal> = {
  superAdmin: 'super',
  collegeAdmin: 'college',
  deptAdmin: 'dept',
  teacher: 'teacher',
  student: 'student',
}
const PORTALS = Object.values(PORTAL_OF)

export const portalOf = (role: Role): Portal => PORTAL_OF[role]

export function parseRoute(hash: string): Route {
  const m = /^#\/([a-z]+)((?:\/[a-z0-9-]+)*)\/?$/.exec(hash)
  if (m?.[1] === 'login') {
    const hint = m[2].split('/').filter(Boolean)[0] as Portal | undefined
    return hint && PORTALS.includes(hint) ? { page: 'login', portal: hint } : { page: 'login' }
  }
  const portal = m?.[1] as Portal | undefined
  if (!portal || !PORTALS.includes(portal)) return { page: 'landing' }
  const path = m![2].split('/').filter(Boolean)
  return path.length ? { page: 'portal', portal, path } : { page: 'portal', portal }
}

export function formatRoute(r: Route): string {
  if (r.page === 'login') return r.portal ? `#/login/${r.portal}` : '#/login'
  return r.page === 'portal' ? `#/${[r.portal, ...(r.path ?? [])].join('/')}` : '#/'
}
