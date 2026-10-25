// Light hash routes (no router library): `#/` landing, `#/<portal>` per role, optionally with a sub-path
// (`#/super/<collegeId>/structure`). Anything that is not `#/…` (e.g. `#colleges`, an in-page anchor)
// counts as the landing page.

import type { Role } from '../types'

export type Portal = 'super' | 'college' | 'dept' | 'teacher' | 'student'
export type Route = { page: 'landing' } | { page: 'portal'; portal: Portal; path?: string[] }

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
  const portal = m?.[1] as Portal | undefined
  if (!portal || !PORTALS.includes(portal)) return { page: 'landing' }
  const path = m![2].split('/').filter(Boolean)
  return path.length ? { page: 'portal', portal, path } : { page: 'portal', portal }
}

export function formatRoute(r: Route): string {
  return r.page === 'portal' ? `#/${[r.portal, ...(r.path ?? [])].join('/')}` : '#/'
}
