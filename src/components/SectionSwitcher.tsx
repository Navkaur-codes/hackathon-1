import type { CollegeData, Id } from '../types'

type Props = { college: CollegeData; sectionId: Id | undefined; onSection: (id: Id) => void }

/** Which section a Student session belongs to (stand-in for logging in until v0.9), grouped by department. */
export function SectionSwitcher({ college, sectionId, onSection }: Props) {
  return (
    <label className="min-w-0">
      <span className="sr-only">Your section</span>
      <select
        value={sectionId ?? ''}
        onChange={(e) => onSection(e.target.value)}
        className="w-full max-w-[12rem] min-w-0 rounded-full border border-marigold bg-card px-3 py-1.5 text-[13px]"
      >
        {college.departments.map((d) => {
          const sections = college.sections.filter((s) => s.deptId === d.id)
          return sections.length === 0 ? null : (
            <optgroup key={d.id} label={d.name}>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </optgroup>
          )
        })}
      </select>
    </label>
  )
}
