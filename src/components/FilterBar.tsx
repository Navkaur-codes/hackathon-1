import { useMemo } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { isActive, type Filters } from '../lib/filters'
import type { CollegeData, RoomType } from '../types'

const KINDS: { id: Filters['kind']; label: string }[] = [
  { id: undefined, label: 'All' },
  { id: 'theory', label: 'Theory' },
  { id: 'lab', label: 'Lab' },
]

const ROOM_LABEL: Record<RoomType, string> = { lecture: 'Lecture room', lab: 'Lab', seminar: 'Seminar hall' }

type Props = {
  college: CollegeData
  filters: Filters
  onChange: (f: Filters) => void
  matching: number
  total: number
}

const selectCls = 'min-w-0 rounded-full border border-rule bg-card px-3 py-1.5 text-[13px]'

/** Filters above the grid: non-matching classes fade back, so the week's shape stays readable. */
export function FilterBar({ college, filters, onChange, matching, total }: Props) {
  // pickers list only what this college has (rule G2)
  const subjects = useMemo(() => {
    const byCode = new Map<string, string>()
    for (const s of college.subjects) if (!byCode.has(s.code)) byCode.set(s.code, s.name)
    return [...byCode].sort(([a], [b]) => a.localeCompare(b))
  }, [college])
  const roomTypes = useMemo(() => [...new Set(college.rooms.map((r) => r.type))], [college])
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch })
  const active = isActive(filters)

  return (
    <div className="no-print rounded-xl border border-rule bg-card/60 p-3" role="group" aria-label="Filter classes">
      <div className="flex flex-wrap items-center gap-2">
        <SlidersHorizontal size={15} className="text-muted" aria-hidden />
        <div role="radiogroup" aria-label="Class type" className="inline-flex rounded-full border border-rule p-0.5">
          {KINDS.map((k) => (
            <button
              key={k.label}
              type="button"
              role="radio"
              aria-checked={filters.kind === k.id}
              onClick={() => set({ kind: k.id })}
              className={`rounded-full px-3 py-1 text-[13px] font-medium transition ${
                filters.kind === k.id ? 'bg-ink text-paper' : 'text-ink hover:bg-ink/5'
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>

        <label className="min-w-0">
          <span className="sr-only">Subject</span>
          <select
            value={filters.subjectCode ?? ''}
            onChange={(e) => set({ subjectCode: e.target.value || undefined })}
            className={`${selectCls} max-w-[13rem]`}
          >
            <option value="">Any subject</option>
            {subjects.map(([code, name]) => (
              <option key={code} value={code}>
                {code} · {name}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-0">
          <span className="sr-only">Day</span>
          <select
            value={filters.day ?? ''}
            onChange={(e) => set({ day: e.target.value === '' ? undefined : Number(e.target.value) })}
            className={selectCls}
          >
            <option value="">Any day</option>
            {college.calendar.days.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-0">
          <span className="sr-only">Room type</span>
          <select
            value={filters.roomType ?? ''}
            onChange={(e) => set({ roomType: (e.target.value || undefined) as RoomType | undefined })}
            className={selectCls}
          >
            <option value="">Any room</option>
            {roomTypes.map((t) => (
              <option key={t} value={t}>
                {ROOM_LABEL[t]}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-0">
          <span className="sr-only">Department</span>
          <select
            value={filters.deptId ?? ''}
            onChange={(e) => set({ deptId: e.target.value || undefined })}
            className={`${selectCls} max-w-[13rem]`}
          >
            <option value="">Any department</option>
            {college.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>

        <div className="ml-auto flex items-center gap-3">
          <span aria-live="polite" className="font-mono text-[11px] tracking-wider text-muted uppercase">
            {active ? (
              <>
                <span className="text-ink">{matching}</span> of {total} classes match
              </>
            ) : (
              `${total} classes`
            )}
          </span>
          {active && (
            <button
              type="button"
              onClick={() => onChange({})}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[13px] text-vermilion transition hover:bg-vermilion/10"
            >
              <X size={14} aria-hidden /> Clear
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
