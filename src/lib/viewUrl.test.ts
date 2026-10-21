import { describe, expect, it } from 'vitest'
import { buildDemoColleges } from '../demoData'
import { solveBest } from '../solver/best'
import { viewFromSearch, viewToSearch, type ViewState } from './viewUrl'

const [, dcas] = buildDemoColleges()

describe('T35.6 shareable timetable URL', () => {
  it('round-trips view, entity, seed and filters', () => {
    const s: ViewState = {
      collegeId: 'diet',
      seed: 7,
      view: 'teacher',
      entityId: 'diet-t-gill',
      filters: { kind: 'lab', subjectCode: 'DS', day: 4, deptId: 'diet-ece', roomType: 'lab' },
    }
    expect(viewFromSearch(`?${viewToSearch(s)}`)).toEqual(s)
    const plain: ViewState = { collegeId: 'dcas', seed: 1, view: 'room', entityId: '', filters: {} }
    expect(viewToSearch(plain)).toBe('college=dcas&seed=1&view=room')
    expect(viewFromSearch(viewToSearch(plain))).toEqual(plain)
  })

  it('needs a college and a numeric seed; bad view falls back to section', () => {
    expect(viewFromSearch('')).toBeNull()
    expect(viewFromSearch('?college=diet')).toBeNull()
    expect(viewFromSearch('?college=diet&seed=abc')).toBeNull()
    expect(viewFromSearch('?college=diet&seed=3&view=nope')?.view).toBe('section')
  })

  it('the seed in the URL reproduces the exact timetable', () => {
    const r = solveBest(dcas, { attempts: 5, baseSeed: 21 })
    const again = solveBest(dcas, { attempts: 1, baseSeed: r.bestSeed })
    expect(again.timetable.placements).toEqual(r.timetable.placements)
    expect(again.score.total).toBe(r.score.total)
  })
})
