import type { CollegeData, Id } from '../types'

type Props = { college: CollegeData; teacherId: Id | undefined; onTeacher: (id: Id) => void }

/** Which teacher a Teacher session is (stand-in for logging in until v0.9), grouped by department. */
export function TeacherSwitcher({ college, teacherId, onTeacher }: Props) {
  return (
    <label className="min-w-0">
      <span className="sr-only">Teacher</span>
      <select
        value={teacherId ?? ''}
        onChange={(e) => onTeacher(e.target.value)}
        className="w-full max-w-[13rem] min-w-0 rounded-full border border-plum bg-card px-3 py-1.5 text-[13px]"
      >
        {college.departments.map((d) => {
          const teachers = college.teachers.filter((t) => t.deptId === d.id)
          return teachers.length === 0 ? null : (
            <optgroup key={d.id} label={d.code}>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </optgroup>
          )
        })}
      </select>
    </label>
  )
}
