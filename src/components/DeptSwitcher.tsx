import type { CollegeData, Id } from '../types'

type Props = { college: CollegeData; deptId: Id | undefined; onDept: (id: Id) => void }

/** Which department an HOD sits at (stand-in for logging in until v0.9). */
export function DeptSwitcher({ college, deptId, onDept }: Props) {
  return (
    <label className="min-w-0">
      <span className="sr-only">Department</span>
      <select
        value={deptId ?? ''}
        onChange={(e) => onDept(e.target.value)}
        className="w-full max-w-[12rem] min-w-0 rounded-full border border-terracotta bg-card px-3 py-1.5 text-[13px]"
      >
        {college.departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.code} · {d.name}
          </option>
        ))}
      </select>
    </label>
  )
}
