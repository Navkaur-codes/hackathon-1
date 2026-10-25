import { describe, expect, it } from 'vitest'
import { formatRoute, parseRoute, portalOf, type Portal } from './route'

describe('hash routes', () => {
  it('round-trips every portal and the landing page', () => {
    for (const portal of ['super', 'college', 'dept', 'teacher', 'student'] as Portal[]) {
      expect(parseRoute(formatRoute({ page: 'portal', portal }))).toEqual({ page: 'portal', portal })
    }
    expect(parseRoute(formatRoute({ page: 'landing' }))).toEqual({ page: 'landing' })
  })

  it('anything else is the landing page (in-page anchors keep working)', () => {
    for (const h of ['', '#', '#colleges', '#/nope', '#/super/extra/bits']) expect(parseRoute(h)).toEqual({ page: 'landing' })
    expect(parseRoute('#/college/')).toEqual({ page: 'portal', portal: 'college' })
  })

  it('each role has its own portal', () => {
    expect(portalOf('superAdmin')).toBe('super')
    expect(portalOf('deptAdmin')).toBe('dept')
  })
})
