import type { CollegeData, Id } from '../types'

type Props = { colleges: CollegeData[]; collegeId: Id | undefined; onCollege: (id: Id) => void }

/** Which college this desk belongs to (only the colleges `switchableColleges` offers). */
export function CollegeSwitcher({ colleges, collegeId, onCollege }: Props) {
  return (
    <label className="min-w-0">
      <span className="sr-only">College</span>
      <select
        value={collegeId ?? ''}
        onChange={(e) => onCollege(e.target.value)}
        className="w-full max-w-[14rem] min-w-0 rounded-full border border-rule bg-card px-3 py-1.5 text-[13px]"
      >
        {colleges.map((c) => (
          <option key={c.college.id} value={c.college.id}>
            {c.college.code} · {c.college.name}
          </option>
        ))}
      </select>
    </label>
  )
}
