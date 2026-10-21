import { describe, expect, it } from 'vitest'
import { buildDemoColleges } from '../demoData'
import { solve } from '../solver/solve'
import { commonFree, freeRooms, freeTeachers, nextFree, nowSlot, occupancy, weekStrip } from './finder'
import { slotKey } from './structure'

const [diet, dcas] = buildDemoColleges()
const t = solve(diet, { seed: 1 })
const occ = occupancy(diet, t)
const D = diet.calendar.days.length
const P = diet.calendar.periodsPerDay
const load = (teacherId: string, day: number) => [...(occ.teacher.get(teacherId) ?? [])].filter((k) => k.startsWith(`${day}-`)).length

describe('T35.1 free teachers', () => {
  it('at every slot: never busy, never unavailable, never pushed over the daily limit — and everyone left out has a reason', () => {
    for (let d = 0; d < D; d++) {
      for (let p = 0; p < P; p++) {
        const free = freeTeachers(diet, occ, d, [p])
        const ids = new Set(free.map((f) => f.teacher.id))
        for (const teacher of diet.teachers) {
          const k = slotKey(d, p)
          const busy = occ.teacher.get(teacher.id)?.has(k) ?? false
          const away = teacher.unavailable.includes(k)
          const full = load(teacher.id, d) + 1 > teacher.maxPerDay
          expect(ids.has(teacher.id), `${teacher.name} ${k}`).toBe(!busy && !away && !full)
        }
      }
    }
  })

  it('the visiting teacher is never free on Saturday', () => {
    for (let p = 0; p < P; p++) expect(freeTeachers(diet, occ, 5, [p]).some((f) => f.teacher.id === 'diet-t-sharma')).toBe(false)
  })

  it('ranks same department, then teaches the subject, then lightest load', () => {
    const free = freeTeachers(diet, occ, 0, [0], { deptId: 'diet-cse', subjectCode: 'DS' })
    const rank = free.map((f) => [Number(f.sameDept), Number(f.teachesSubject), -f.load])
    const sorted = [...rank].sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2])
    expect(rank).toEqual(sorted)
    for (const f of free.filter((x) => x.teachesSubject)) expect(['diet-t-kaur', 'diet-t-bedi']).toContain(f.teacher.id)
  })

  it('a two-period window needs the teacher free for both periods', () => {
    const both = freeTeachers(diet, occ, 1, [4, 5]).map((f) => f.teacher.id)
    for (const id of both) {
      expect(occ.teacher.get(id)?.has('1-4') ?? false).toBe(false)
      expect(occ.teacher.get(id)?.has('1-5') ?? false).toBe(false)
    }
  })
})

describe('T35.2 free rooms', () => {
  it('only rooms with no class then, of the right type and size', () => {
    for (let d = 0; d < D; d++) {
      for (let p = 0; p < P; p++) {
        for (const f of freeRooms(diet, occ, d, [p], { type: 'lab', minCapacity: 60 })) {
          expect(f.room.type).toBe('lab')
          expect(f.room.capacity).toBeGreaterThanOrEqual(60)
          expect(occ.room.get(f.room.id)?.has(slotKey(d, p)) ?? false).toBe(false)
        }
      }
    }
  })

  it('labels who may use each room, and an approved grant turns needs-grant into granted', () => {
    const empty = { ...t, placements: [] }
    const none = occupancy(diet, empty)
    const use = (c = diet) => Object.fromEntries(freeRooms(c, none, 0, [0], { forDeptId: 'diet-cse' }).map((f) => [f.room.name, f.usable]))
    const before = use()
    expect(before['LT-101']).toBe('own')
    expect(before['CL-1 Computer Lab']).toBe('shared')
    expect(before['LT-201']).toBe('needs-grant')
    const c = buildDemoColleges()[0]
    c.grants.push({ id: 'g', collegeId: 'diet', roomId: 'diet-rm-lt-201', fromDeptId: 'diet-ece', toDeptId: 'diet-cse', slots: 'all', status: 'approved' })
    expect(use(c)['LT-201']).toBe('granted')
  })
})

describe('T35.3 common free slots', () => {
  it('equal the intersection of each entity’s free slots', () => {
    const entities = [
      { kind: 'teacher' as const, id: 'diet-t-kaur' },
      { kind: 'teacher' as const, id: 'diet-t-gill' },
      { kind: 'room' as const, id: 'diet-rm-seminar-hall' },
    ]
    const strips = entities.map((e) => weekStrip(diet, occ, e.kind, e.id))
    const expected: string[] = []
    for (let d = 0; d < D; d++) for (let p = 0; p < P; p++) if (strips.every((s) => s[d][p] === 'free')) expected.push(slotKey(d, p))
    const got = commonFree(diet, occ, entities)
    expect(got).toEqual(expected)
    expect(got.length).toBeGreaterThan(0)
    expect(commonFree(diet, occ, [])).toEqual([])
  })

  it('never offers a section’s break or a teacher’s unavailable slot', () => {
    const cse = diet.sections.find((s) => s.name.startsWith('CSE'))!
    const slots = commonFree(diet, occ, [{ kind: 'section', id: cse.id }, { kind: 'teacher', id: 'diet-t-sharma' }])
    expect(slots.some((k) => k.endsWith('-3'))).toBe(false) // CSE lunch
    expect(slots.some((k) => k.startsWith('5-'))).toBe(false) // Sharma's Saturday
  })
})

describe('T35.4 week strip, next free, now', () => {
  it('marks busy · free · break · unavailable', () => {
    const ece = diet.sections.find((s) => s.name.startsWith('ECE'))!
    const strip = weekStrip(diet, occ, 'section', ece.id)
    expect(strip).toHaveLength(D)
    expect(strip.every((row) => row[4] === 'break')).toBe(true) // ECE's staggered lunch
    const sharma = weekStrip(diet, occ, 'teacher', 'diet-t-sharma')
    expect(sharma[5].every((s) => s === 'unavailable')).toBe(true)
  })

  it('next free = first free slot at or after the given time, wrapping the week', () => {
    const strip = weekStrip(diet, occ, 'teacher', 'diet-t-kaur')
    const busy = [...occ.teacher.get('diet-t-kaur')!][0]
    const [d, p] = busy.split('-').map(Number)
    const next = nextFree(strip, { day: d, period: p })!
    expect(strip[next.day][next.period]).toBe('free')
    expect(next.day * P + next.period).not.toBe(d * P + p)
    expect(nextFree([['busy', 'busy']], { day: 0, period: 0 })).toBeNull()
    expect(nextFree([['free', 'busy']], { day: 0, period: 1 })).toEqual({ day: 0, period: 0 }) // wraps
  })

  it('maps a real clock time to the pattern slot', () => {
    expect(nowSlot(diet.calendar, new Date(2026, 9, 26, 10, 0))).toEqual({ day: 0, period: 1 }) // Mon 10:00 → P2 (09:50–10:40)
    expect(nowSlot(diet.calendar, new Date(2026, 9, 31, 14, 49))).toEqual({ day: 5, period: 6 }) // Sat, last period
    expect(nowSlot(diet.calendar, new Date(2026, 9, 25, 10, 0))).toBeNull() // Sunday
    expect(nowSlot(diet.calendar, new Date(2026, 9, 26, 8, 0))).toBeNull() // before college
    expect(nowSlot(dcas.calendar, new Date(2026, 9, 26, 11, 30))).toEqual({ day: 0, period: 2 }) // DCAS 30-min lunch slot
    expect(nowSlot(dcas.calendar, new Date(2026, 9, 31, 11, 30))).toBeNull() // DCAS does not work Saturdays
  })
})
