import { compressToEncodedURIComponent } from 'lz-string'
import { describe, expect, it } from 'vitest'
import { buildDemoColleges } from '../demoData'
import { solve } from '../solver/solve'
import { guard } from './access'
import { updateProgramme } from './edit'
import { buildGrid } from './gridModel'
import { publish, setDraft } from './publish'
import {
  collegeKey,
  decodePublic,
  deptKey,
  deptSnapshot,
  encodePublic,
  levelOf,
  parsePublicPath,
  publicCollege,
  publicDept,
  publicParts,
  publicUrl,
  snapshotCollege,
  tabIds,
  TAB_VIEW,
} from './publicView'
import { formatRoute, parseRoute } from './route'
import type { CollegeData } from '../types'

const [diet, dcas] = buildDemoColleges()
const pub = (c: CollegeData) => {
  const r = publish(setDraft(c, solve(c, { seed: 1 })), '2026-10-27T10:00:00.000Z')
  if (!r.ok) throw new Error(r.reasons.join())
  return r.college
}
const liveDiet = pub(diet)
const liveDcas = pub(dcas)

describe('T9.7 only published, active colleges are public — never a draft', () => {
  it('resolves by college code only once published', () => {
    expect(publicCollege([diet, dcas], collegeKey(diet))).toBeUndefined()
    expect(publicCollege([liveDiet, dcas], 'diet')).toBe(liveDiet)
    expect(publicCollege([liveDiet], 'nope')).toBeUndefined()
    const archived = { ...liveDiet, college: { ...liveDiet.college, status: 'archived' as const } }
    expect(publicCollege([archived], 'diet')).toBeUndefined()
  })

  it('the snapshot holds the published placements, not a newer draft', () => {
    const redrafted = setDraft(liveDiet, solve(liveDiet, { seed: 9 }))
    const snap = deptSnapshot(redrafted, 'cse')!
    const published = new Set(liveDiet.published!.timetable.placements.map((p) => JSON.stringify(p)))
    expect(snap.data.published.timetable.placements.every((p) => published.has(JSON.stringify(p)))).toBe(true)
    expect('draft' in snap.data).toBe(false)
    expect(deptSnapshot(diet, 'cse')).toBeUndefined()
  })

  it('a teacher’s unavailable slots and every request stay out of the link', () => {
    const c = snapshotCollege(deptSnapshot(liveDiet, 'ece')!)
    expect(c.teachers.every((t) => t.unavailable.length === 0)).toBe(true)
    expect([c.leaves, c.meetings, c.substitutions, c.grants]).toEqual([[], [], [], []])
  })
})

describe('T9.8 each tab lists exactly the department’s own', () => {
  for (const live of [liveDiet, liveDcas]) {
    for (const d of live.departments) {
      it(`${live.college.code} ${d.code}: faculty, classes, rooms`, () => {
        const pd = publicDept(live, deptKey(d))!
        expect(new Set(tabIds(pd, 'faculty'))).toEqual(new Set(live.teachers.filter((t) => t.deptId === d.id).map((t) => t.id)))
        expect(new Set(tabIds(pd, 'class'))).toEqual(new Set(live.sections.filter((s) => s.deptId === d.id).map((s) => s.id)))
        const used = new Set(live.published!.timetable.placements.filter((p) => p.deptId === d.id).map((p) => p.roomId))
        const rooms = live.rooms.filter((r) => r.owner === d.id || used.has(r.id))
        expect(new Set(tabIds(pd, 'room'))).toEqual(new Set(rooms.map((r) => r.id)))
        // own rooms come first
        const firstOther = pd.rooms.findIndex((r) => r.use !== 'own')
        expect(firstOther === -1 || pd.rooms.slice(firstOther).every((r) => r.use !== 'own')).toBe(true)
      })
    }
  }

  it('classes group by level, then year — levels come from config', () => {
    const cse = liveDiet.departments.find((d) => d.code === 'CSE')!
    const y3 = liveDiet.programmes.find((p) => p.deptId === cse.id && p.shortName === 'Y3')!
    expect(levelOf(y3)).toBe('UG')
    const withPg = updateProgramme(liveDiet, y3.id, { level: ' PG ' })
    const pd = publicDept(withPg, 'cse')!
    expect(pd.levels.map((g) => g.level)).toEqual(['UG', 'PG'])
    expect(pd.levels[1].programmes.map((p) => p.programme.id)).toEqual([y3.id])
    expect(levelOf(updateProgramme(withPg, y3.id, { level: '  ' }).programmes.find((p) => p.id === y3.id)!)).toBe('UG')
  })
})

describe('T9.9 links: snapshot round trip and deep paths', () => {
  it('every timetable on the page is identical when rebuilt from the link', () => {
    for (const live of [liveDiet, liveDcas])
      for (const d of live.departments) {
        const snap = decodePublic(encodePublic(deptSnapshot(live, deptKey(d))!))!
        expect(snap).not.toBeNull()
        const copy = snapshotCollege(snap)
        const pd = publicDept(copy, deptKey(d))!
        for (const tab of ['faculty', 'class', 'room'] as const) {
          expect(tabIds(pd, tab)).toEqual(tabIds(publicDept(live, deptKey(d))!, tab))
          for (const id of tabIds(pd, tab)) {
            const a = buildGrid(live, live.published!.timetable, TAB_VIEW[tab], id)
            const b = buildGrid(copy, copy.published!.timetable, TAB_VIEW[tab], id)
            expect(b.cells.map((x) => x.key)).toEqual(a.cells.map((x) => x.key))
            expect(b.breaks).toEqual(a.breaks)
            expect([b.title, b.subtitle]).toEqual([a.title, a.subtitle])
          }
        }
      }
  })

  it('the link stays a sensible length', () => {
    const url = publicUrl('https://kaalchakra-seven.vercel.app/', liveDiet, liveDiet.departments[0])!
    expect(url).toMatch(/^https:\/\/kaalchakra-seven\.vercel\.app\/\?p=[A-Za-z0-9+\-$]+#\/t\/diet\/cse$/)
    expect(url.length).toBeLessThan(16_000)
  })

  it('broken, foreign or inconsistent links are refused', () => {
    const snap = deptSnapshot(liveDiet, 'cse')!
    expect(decodePublic(null)).toBeNull()
    expect(decodePublic('not-a-link')).toBeNull()
    expect(decodePublic(compressToEncodedURIComponent(JSON.stringify({ v: 2 })))).toBeNull()
    const outside = structuredClone(snap)
    outside.data.published.timetable.placements[0].day = 99
    expect(decodePublic(encodePublic(outside))).toBeNull()
    const dangling = structuredClone(snap)
    dangling.data.published.timetable.placements[0].roomId = 'nowhere'
    expect(decodePublic(encodePublic(dangling))).toBeNull()
  })

  it('paths parse, format and stay public', () => {
    expect(parsePublicPath(['diet', 'cse', 'class', 'x'])).toEqual({ college: 'diet', dept: 'cse', tab: 'class', id: 'x' })
    expect(parsePublicPath(['diet', 'cse', 'bogus'])).toEqual({ college: 'diet', dept: 'cse' })
    expect(parsePublicPath([])).toBeUndefined()
    expect(publicParts({ college: 'diet', dept: 'cse', tab: 'room', id: 'r1' })).toEqual(['diet', 'cse', 'room', 'r1'])
    const r = parseRoute('#/t/diet/cse/faculty/diet-t-kaur')
    expect(r).toEqual({ page: 'public', path: ['diet', 'cse', 'faculty', 'diet-t-kaur'] })
    expect(formatRoute(r)).toBe('#/t/diet/cse/faculty/diet-t-kaur')
    expect(guard(null, r)).toBe(r)
    expect(guard({ role: 'collegeAdmin', collegeId: 'diet' }, r)).toBe(r)
  })
})
