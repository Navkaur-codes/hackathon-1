import { useState } from 'react'
import { assignedLoad, setAssignmentTeacher } from '../../../lib/edit'
import type { CollegeData, Id } from '../../../types'
import type { Edit } from './tabs'

const field = 'rounded-lg border border-rule bg-paper px-2 py-1.5 text-[14px]'

/** Section × subject → teacher (rule G5). Teachers of the section's department are listed first. */
export function AssignmentsTab({ college, edit }: { college: CollegeData; edit: Edit }) {
  const [sectionId, setSectionId] = useState<Id>(college.sections[0]?.id ?? '')
  const [onlyOpen, setOnlyOpen] = useState(false)
  const section = college.sections.find((s) => s.id === sectionId) ?? college.sections[0]
  if (!section) return <p className="text-[14px] text-muted">No sections yet — the Super Admin adds programmes and sections in the Structure Builder.</p>

  const load = assignedLoad(college)
  const subjects = new Map(college.subjects.map((s) => [s.id, s]))
  const deptName = new Map(college.departments.map((d) => [d.id, d.code]))
  const total = college.assignments.length
  const done = college.assignments.filter((a) => a.teacherId).length
  const openBySection = new Map<Id, number>()
  for (const a of college.assignments) if (!a.teacherId) openBySection.set(a.sectionId, (openBySection.get(a.sectionId) ?? 0) + 1)
  const rows = college.assignments.filter((a) => a.sectionId === section.id && (!onlyOpen || !a.teacherId))
  const ownFirst = [...college.teachers].sort((x, y) => Number(y.deptId === section.deptId) - Number(x.deptId === section.deptId) || x.name.localeCompare(y.name))
  const nextOpen = college.sections.find((s) => (openBySection.get(s.id) ?? 0) > 0)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[14px]">
          <span className="font-mono text-[11px] tracking-[0.15em] text-muted uppercase">Section</span>
          <select value={section.id} onChange={(e) => setSectionId(e.target.value)} className={field}>
            {college.departments.map((d) => (
              <optgroup key={d.id} label={d.name}>
                {college.sections
                  .filter((s) => s.deptId === d.id)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {openBySection.get(s.id) ? ` — ${openBySection.get(s.id)} to assign` : ''}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-[13px]">
          <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} className="h-4 w-4 accent-[var(--ink)]" /> Only unassigned
        </label>
        <span className="text-[13px] text-muted" aria-live="polite">
          {done} of {total} classes have a teacher
        </span>
        {nextOpen && nextOpen.id !== section.id && (
          <button type="button" onClick={() => setSectionId(nextOpen.id)} className="rounded-full border border-rule px-3 py-1 text-[13px] hover:border-ink">
            Next to assign: {nextOpen.name}
          </button>
        )}
      </div>

      <ul className="divide-y divide-rule rounded-lg border border-rule">
        {rows.map((a) => {
          const s = subjects.get(a.subjectId)!
          return (
            <li key={a.id} className={`flex flex-wrap items-center gap-3 px-3 py-2 ${a.teacherId ? '' : 'bg-vermilion/5'}`}>
              <span className="w-14 font-mono text-[12px] text-muted">{s.code}</span>
              <span className="min-w-0 flex-1 text-[14px]">
                {s.name}
                <span className="ml-2 text-[12px] text-muted">
                  {s.periodsPerWeek} periods{s.kind === 'lab' ? ' · lab' : ''}
                </span>
              </span>
              <label className="min-w-0">
                <span className="sr-only">Teacher for {s.name}, {section.name}</span>
                <select
                  value={a.teacherId ?? ''}
                  onChange={(e) => edit((c) => setAssignmentTeacher(c, a.id, e.target.value || null))}
                  className={`${field} max-w-[16rem] ${a.teacherId ? '' : 'border-vermilion'}`}
                >
                  <option value="">— choose a teacher —</option>
                  {ownFirst.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} · {deptName.get(t.deptId)} · {load.get(t.id) ?? 0}/{t.maxPerWeek}
                    </option>
                  ))}
                </select>
              </label>
            </li>
          )
        })}
        {rows.length === 0 && <li className="px-3 py-2 text-[13px] text-muted">{onlyOpen ? 'Every subject of this section has a teacher.' : 'This section takes no subjects yet.'}</li>}
      </ul>
      <p className="text-[12px] text-muted">The numbers after a name are periods already given / weekly limit. A teacher may teach in any department.</p>
    </div>
  )
}
