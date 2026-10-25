import { BreakEditor } from '../../../components/BreakEditor'
import { NumberField, TextField } from '../../../components/fields'
import { setBreaks, updateSection } from '../../../lib/edit'
import type { CollegeData } from '../../../types'
import type { Edit } from './tabs'

/** Rename sections, adjust their strength and give a section its own breaks (within the Super Admin's structure). */
export function SectionsTab({ college, edit }: { college: CollegeData; edit: Edit }) {
  const prog = new Map(college.programmes.map((p) => [p.id, p]))
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted">
        How many sections a year has is set by the Super Admin; here you name them, set how many students each has, and give one its own breaks.
      </p>
      {college.departments.map((d) => (
        <section key={d.id} aria-label={d.name}>
          <h3 className="mb-2 font-display text-base font-semibold">{d.name}</h3>
          <ul className="space-y-2">
            {college.sections
              .filter((s) => s.deptId === d.id)
              .map((s) => (
                <li key={s.id} className="rounded-lg border border-rule p-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <TextField label="Section" value={s.name} className="w-40" onCommit={(v) => edit((c) => updateSection(c, s.id, { name: v }))} />
                    <NumberField label="Students" value={s.strength} min={1} max={1000} onCommit={(n) => edit((c) => updateSection(c, s.id, { strength: n ?? 1 }))} />
                    <span className="pb-2 text-[13px] text-muted">{prog.get(s.programmeId)?.name}</span>
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[13px] text-muted hover:text-ink">Breaks for {s.name}{s.breaks ? ' (own)' : ''}</summary>
                    <div className="mt-2">
                      <BreakEditor calendar={college.calendar} rules={s.breaks} inheritFrom="its year" onChange={(rules) => edit((c) => setBreaks(c, 'section', s.id, rules))} />
                    </div>
                  </details>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
