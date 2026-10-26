import { compressToEncodedURIComponent } from 'lz-string'
import { describe, expect, it } from 'vitest'
import { buildDemoColleges } from '../demoData'
import { solve } from '../solver/solve'
import { buildGrid } from './gridModel'
import { publish, setDraft } from './publish'
import { decodeShare, encodeShare, shareUrl, snapshotGrid, snapshotOf } from './share'

const [diet, dcas] = buildDemoColleges()
const pub = (c: typeof diet) => {
  const r = publish(setDraft(c, solve(c, { seed: 1 })), '2026-10-27T10:00:00.000Z')
  if (!r.ok) throw new Error(r.reasons.join())
  return r.college
}
const live = pub(diet)
const section = diet.sections[0]

describe('T6.4 share link', () => {
  it('encode → decode round-trips the published week of one section', () => {
    const snap = snapshotOf(live, section.id)!
    const back = decodeShare(encodeShare(snap))
    expect(back).toEqual(snap)
    expect(back).toMatchObject({ section: section.name, version: 1, college: diet.college.name })
  })

  it('the shared grid shows the same classes, times and breaks as the real one', () => {
    const real = buildGrid(live, live.published!.timetable, 'section', section.id)
    const shared = snapshotGrid(decodeShare(encodeShare(snapshotOf(live, section.id)!))!)
    expect(shared.days).toEqual(real.days)
    expect(shared.rows).toEqual(real.rows)
    expect(shared.breaks).toEqual(real.breaks)
    expect(shared.cells.map((c) => [c.day, c.start, c.span, c.subject.code, c.subject.name, c.lab, c.detail])).toEqual(
      real.cells.map((c) => [c.day, c.start, c.span, c.subject.code, c.subject.name, c.lab, c.detail]),
    )
  })

  it('works for any calendar shape (DCAS) and fits in a URL', () => {
    const d = pub(dcas)
    for (const s of d.sections) {
      const url = shareUrl('https://kaalchakra-seven.vercel.app/', snapshotOf(d, s.id)!)
      expect(url.length).toBeLessThan(2000)
      expect(decodeShare(new URL(url).searchParams.get('s'))?.section).toBe(s.name)
    }
  })

  it('nothing published or unknown section → no snapshot (a draft is never shared)', () => {
    expect(snapshotOf(setDraft(diet, solve(diet, { seed: 1 })), section.id)).toBeUndefined()
    expect(snapshotOf(live, 'nope')).toBeUndefined()
  })

  it('a broken or foreign link is refused, never thrown', () => {
    const good = encodeShare(snapshotOf(live, section.id)!)
    expect(decodeShare('')).toBeNull()
    expect(decodeShare(null)).toBeNull()
    expect(decodeShare('not-a-link')).toBeNull()
    expect(decodeShare(good.slice(0, good.length / 2))).toBeNull()
    expect(decodeShare(compressToEncodedURIComponent('{"v":2}'))).toBeNull()
    expect(decodeShare(compressToEncodedURIComponent('[1,2,3]'))).toBeNull()
    // a class outside the grid
    const snap = snapshotOf(live, section.id)!
    const bad = { ...snap, cells: [[0, snap.rows.length - 1, 2, 'X', 'X', 0, '']] }
    expect(decodeShare(compressToEncodedURIComponent(JSON.stringify(bad)))).toBeNull()
  })
})
