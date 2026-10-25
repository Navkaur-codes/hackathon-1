import { describe, expect, it } from 'vitest'
import type { StateStorage } from 'zustand/middleware'
import { buildDemoColleges } from './demoData'
import { cloneCollege } from './lib/edit'
import { createKaalStore, STORE_KEY } from './store'

/** localStorage stand-in: a plain map that survives between two store instances (= a page reload). */
function memoryStorage(): StateStorage & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  }
}

const [diet, dcas] = buildDemoColleges()

describe('T4.2 store persists across a reload', () => {
  it('first load seeds the two demo colleges and no session', () => {
    const store = createKaalStore(memoryStorage())
    const s = store.getState()
    expect(s.colleges.map((c) => c.college.id)).toEqual([diet.college.id, dcas.college.id])
    expect(s.session).toBeNull()
  })

  it('persist → reload gives identical colleges and session', () => {
    const storage = memoryStorage()
    const a = createKaalStore(storage)
    a.getState().enterAs('collegeAdmin')
    a.getState().switchCollege(dcas.college.id)
    a.getState().updateCollege(dcas.college.id, (c) => ({ ...c, teachers: c.teachers.map((t, i) => (i === 0 ? { ...t, maxPerDay: 2 } : t)) }))
    expect(storage.data.has(STORE_KEY)).toBe(true)

    const b = createKaalStore(storage) // a fresh page load reading the same storage
    expect(b.getState().session).toEqual({ role: 'collegeAdmin', collegeId: dcas.college.id })
    expect(b.getState().colleges).toEqual(a.getState().colleges)
    expect(b.getState().colleges[1].teachers[0].maxPerDay).toBe(2)
  })

  it('a new college is added once and survives a reload', () => {
    const storage = memoryStorage()
    const a = createKaalStore(storage)
    const clone = cloneCollege(diet, 'GNDEC', 'Guru Nanak Dev Engineering College')
    a.getState().addCollege(clone)
    a.getState().addCollege(clone) // same id again → ignored
    expect(a.getState().colleges.map((c) => c.college.id)).toEqual([diet.college.id, dcas.college.id, 'gndec'])
    expect(createKaalStore(storage).getState().colleges[2]).toEqual(clone)
  })

  it('an edit touches only its own college (rule G1)', () => {
    const store = createKaalStore(memoryStorage())
    store.getState().updateCollege(dcas.college.id, (c) => ({ ...c, college: { ...c.college, name: 'Renamed' } }))
    const [d, c] = store.getState().colleges
    expect(d).toEqual(diet)
    expect(c.college.name).toBe('Renamed')
  })

  it('switching to an unknown college is ignored; sign out clears the session', () => {
    const store = createKaalStore(memoryStorage())
    store.getState().enterAs('teacher')
    store.getState().switchCollege('nope')
    expect(store.getState().session?.collegeId).toBe(diet.college.id)
    store.getState().signOut()
    expect(store.getState().session).toBeNull()
  })

  it('reset demo data restores the seed and keeps a fitting session', () => {
    const store = createKaalStore(memoryStorage())
    store.getState().enterAs('collegeAdmin')
    store.getState().switchCollege(dcas.college.id)
    store.getState().updateCollege(dcas.college.id, (c) => ({ ...c, rooms: [] }))
    store.getState().resetDemo()
    expect(store.getState().colleges).toEqual([diet, dcas])
    expect(store.getState().session).toEqual({ role: 'collegeAdmin', collegeId: dcas.college.id })
  })

  it('old or corrupt saved data falls back to the seed', () => {
    const old = memoryStorage()
    old.setItem(STORE_KEY, JSON.stringify({ state: { colleges: [{ broken: true }], session: null }, version: 0 }))
    expect(createKaalStore(old).getState().colleges).toEqual([diet, dcas])

    const corrupt = memoryStorage()
    corrupt.setItem(STORE_KEY, JSON.stringify({ state: { colleges: 'nope' }, version: 1 }))
    expect(createKaalStore(corrupt).getState().colleges).toEqual([diet, dcas])
  })
})
