import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { NumberField, TextField } from '../../../components/fields'
import { SlotGrid } from '../../../components/SlotGrid'
import { addTeacher, assignedLoad, removeTeacher, teacherProblem, toggleUnavailable, updateTeacher } from '../../../lib/edit'
import type { CollegeData, Id, SlotKey } from '../../../types'
import type { Edit } from './tabs'

const field = 'rounded-lg border border-rule bg-paper px-2 py-1.5 text-[14px]'
const small = 'font-mono text-[11px] tracking-[0.15em] text-muted uppercase'

/** Teachers of every department (or one, on an HOD desk): limits (H9), availability (H6), load already given. */
export function TeachersTab({ college, edit, deptId }: { college: CollegeData; edit: Edit; deptId?: Id }) {
  const load = assignedLoad(college)
  const blocked = new Map<SlotKey, string>(college.calendar.blockedSlots.map((k) => [k, 'blocked for the whole college']))
  const [draft, setDraft] = useState({ name: '', deptId: deptId ?? college.departments[0]?.id ?? '', day: '4', week: '16' })
  const teachers = deptId ? college.teachers.filter((t) => t.deptId === deptId) : college.teachers
  const deptCode = college.departments.find((d) => d.id === deptId)?.code
  const [tried, setTried] = useState(false)
  const problem = teacherProblem(college, draft.name)

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {teachers.map((t) => {
          const given = load.get(t.id) ?? 0
          const over = given > t.maxPerWeek
          return (
            <li key={t.id} className="rounded-lg border border-rule p-3">
              <div className="flex flex-wrap items-end gap-3">
                <TextField label="Teacher" value={t.name} className="w-52" onCommit={(v) => !teacherProblem(college, v, t.id) && edit((c) => updateTeacher(c, t.id, { name: v }))} />
                {!deptId && (
                <label className="flex flex-col gap-1">
                  <span className={small}>Department</span>
                  <select value={t.deptId} onChange={(e) => edit((c) => updateTeacher(c, t.id, { deptId: e.target.value }))} className={field}>
                    {college.departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code}
                      </option>
                    ))}
                  </select>
                </label>
                )}
                <NumberField label="Max / day" value={t.maxPerDay} min={1} max={college.calendar.periodsPerDay} onCommit={(n) => edit((c) => updateTeacher(c, t.id, { maxPerDay: n ?? 1 }))} />
                <NumberField label="Max / week" value={t.maxPerWeek} min={1} max={100} onCommit={(n) => edit((c) => updateTeacher(c, t.id, { maxPerWeek: n ?? 1 }))} />
                <span className={`pb-2 text-[13px] ${over ? 'text-vermilion' : 'text-muted'}`}>
                  {given} of {t.maxPerWeek} periods given{over ? ' — over the limit' : ''}
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${t.name}`}
                  onClick={() => window.confirm(`Remove ${t.name}? Their classes will need another teacher.`) && edit((c) => removeTeacher(c, t.id))}
                  className="ml-auto rounded-full p-2 text-muted hover:bg-ink/5 hover:text-vermilion"
                >
                  <Trash2 size={15} aria-hidden />
                </button>
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-[13px] text-muted hover:text-ink">
                  Availability — {t.unavailable.length ? `${t.unavailable.length} slot${t.unavailable.length > 1 ? 's' : ''} unavailable` : 'available every slot'}
                </summary>
                <p className="mt-2 text-[12px] text-muted">Click a slot to mark it unavailable (striped); click again to free it.</p>
                <div className="mt-1">
                  <SlotGrid
                    calendar={college.calendar}
                    marked={t.unavailable}
                    locked={blocked}
                    markLabel="unavailable"
                    label={`${t.name} availability`}
                    onToggle={(k) => edit((c) => toggleUnavailable(c, t.id, k))}
                  />
                </div>
              </details>
            </li>
          )
        })}
        {teachers.length === 0 && <li className="text-[13px] text-muted">No teachers yet — add them below or paste a list from Excel.</li>}
      </ul>

      <form
        aria-label="Add a teacher"
        onSubmit={(e) => {
          e.preventDefault()
          setTried(true)
          if (problem || !draft.deptId) return
          edit((c) => addTeacher(c, { name: draft.name, deptId: draft.deptId, maxPerDay: Number(draft.day), maxPerWeek: Number(draft.week) }))
          setDraft({ ...draft, name: '' })
          setTried(false)
        }}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-rule p-3"
      >
        <label className="flex flex-col gap-1">
          <span className={small}>Teacher</span>
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Dr. Harpreet Kaur" className={`${field} w-52`} />
        </label>
        {deptId ? (
          <span className="pb-2 text-[13px] text-muted">in {deptCode}</span>
        ) : (
          <label className="flex flex-col gap-1">
            <span className={small}>Department</span>
            <select value={draft.deptId} onChange={(e) => setDraft({ ...draft, deptId: e.target.value })} className={field}>
              {college.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className={small}>Max / day</span>
          <input type="number" min={1} value={draft.day} onChange={(e) => setDraft({ ...draft, day: e.target.value })} className={`${field} w-20`} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={small}>Max / week</span>
          <input type="number" min={1} value={draft.week} onChange={(e) => setDraft({ ...draft, week: e.target.value })} className={`${field} w-20`} />
        </label>
        <button type="submit" className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-[13px] font-medium text-paper">
          <Plus size={14} aria-hidden /> Add teacher
        </button>
        {tried && problem && (
          <p role="alert" className="basis-full text-[13px] text-vermilion">
            {problem}
          </p>
        )}
      </form>
    </div>
  )
}
