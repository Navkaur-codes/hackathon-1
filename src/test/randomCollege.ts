// Test-only helper: random colleges of random shapes for property tests (never imported by the app).
import type { CollegeSpec, DepartmentSpec } from '../lib/structure'
import type { Rng } from '../solver/rng'

export function randomSpec(rng: Rng, n: number): CollegeSpec {
  const int = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1))
  const pick = <T,>(xs: T[]) => xs[Math.floor(rng() * xs.length)]
  const days = int(3, 6)
  const periods = int(4, 8)
  const lunch = int(1, periods - 2)
  const deptCount = int(1, 3)
  const teacherKeys: string[] = []
  const departments: DepartmentSpec[] = []
  for (let d = 0; d < deptCount; d++) {
    const teachers = Array.from({ length: int(1, 3) }, (_, i) => {
      const key = `d${d}t${i}`
      teacherKeys.push(key)
      const unavailable: [number, number][] = rng() < 0.4 ? [[int(0, days - 1), int(0, periods - 1)]] : []
      return { key, name: key, maxPerDay: int(2, 5), maxPerWeek: int(6, 20), unavailable }
    })
    departments.push({
      code: `D${d}`,
      name: `Dept ${d}`,
      breaks: rng() < 0.5 ? [{ period: Math.min(periods - 1, lunch + int(0, 1)) }] : undefined,
      rooms: [
        { name: `D${d}-L`, type: 'lecture', capacity: int(30, 70) },
        ...(rng() < 0.6 ? [{ name: `D${d}-LAB`, type: 'lab' as const, capacity: int(30, 70) }] : []),
      ],
      teachers,
      programmes: Array.from({ length: int(1, 2) }, (_, p) => ({
        name: `P${p}`,
        shortName: `P${p}`,
        sectionsCount: int(1, 2),
        defaultStrength: int(25, 60),
        subjects: Array.from({ length: int(1, 4) }, (_, s) => {
          const lab = rng() < 0.3
          return {
            code: `S${s}`,
            name: `S${s}`,
            kind: lab ? ('lab' as const) : ('theory' as const),
            periodsPerWeek: lab ? int(2, 3) : int(1, 4),
            teachers: [pick(teachers).key, ...(rng() < 0.3 ? [pick(teachers).key] : [])],
          }
        }),
      })),
    })
  }
  // occasionally a teacher teaches in another department
  if (deptCount > 1 && rng() < 0.6) departments[1].programmes[0].subjects[0].teachers = [departments[0].teachers[0].key]
  return {
    code: `R${n}`,
    name: `Random ${n}`,
    calendar: {
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].slice(0, days),
      weekdays: Array.from({ length: days }, (_, i) => i + 1),
      periodsPerDay: periods,
      startTime: '09:00',
      periodMinutes: 50,
      breaks: [{ period: lunch }],
      lunchWindow: [lunch, Math.min(periods - 1, lunch + 1)],
      teacherMinFreeInLunchWindow: 1,
      blockedSlots: rng() < 0.3 ? [`${int(0, days - 1)}-${int(0, periods - 1)}` as `${number}-${number}`] : [],
      labBlockLength: 2,
      maxMeetingRequestsPerStudent: 3,
    },
    semester: { name: 'Test semester', startDate: '2026-07-20', endDate: '2026-08-16', holidays: [], noClassDates: [] },
    sharedRooms: [
      { name: 'Shared-L', type: 'lecture', capacity: 80 },
      ...(rng() < 0.5 ? [{ name: 'Shared-LAB', type: 'lab' as const, capacity: 80 }] : []),
    ],
    departments,
  }
}
