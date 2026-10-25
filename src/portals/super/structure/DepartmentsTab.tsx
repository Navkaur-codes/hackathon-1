import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { NumberField, TextField } from '../../../components/fields'
import {
  addDepartment,
  addProgramme,
  deptCodeProblem,
  programmeProblem,
  removeDepartment,
  removeDepartmentProblem,
  removeProgramme,
  renameDepartment,
  setBreaks,
  updateProgramme,
} from '../../../lib/edit'
import type { CollegeData, Department, Programme } from '../../../types'
import { BreakEditor } from '../../../components/BreakEditor'

type Edit = (fn: (c: CollegeData) => CollegeData) => void
type Props = { college: CollegeData; edit: Edit }

const field = 'rounded-lg border border-rule bg-paper px-2.5 py-1.5 text-[14px]'
const small = 'font-mono text-[11px] tracking-[0.15em] text-muted uppercase'

function AddProgramme({ college, dept, edit }: { college: CollegeData; dept: Department; edit: Edit }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [short, setShort] = useState('')
  const [count, setCount] = useState('1')
  const [strength, setStrength] = useState('60')
  const [tried, setTried] = useState(false)
  const problem = programmeProblem(college, dept.id, short)
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-full border border-rule px-3 py-1.5 text-[13px] hover:border-ink">
        <Plus size={14} aria-hidden /> Add a year / programme
      </button>
    )
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setTried(true)
        if (problem) return
        edit((c) => addProgramme(c, dept.id, { name: name || `${dept.code} — ${short}`, shortName: short, sectionsCount: Number(count), defaultStrength: Number(strength) }))
        setOpen(false)
        setName('')
        setShort('')
        setTried(false)
      }}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-ink p-3"
    >
      <label className="flex flex-col gap-1">
        <span className={small}>Name</span>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={`B.Tech ${dept.code} — Year 1`} className={`${field} w-56`} />
      </label>
      <label className="flex flex-col gap-1">
        <span className={small}>Short</span>
        <input value={short} onChange={(e) => setShort(e.target.value.toUpperCase())} placeholder="Y1" className={`${field} w-20 font-mono`} />
      </label>
      <label className="flex flex-col gap-1">
        <span className={small}>Sections</span>
        <input type="number" min={1} max={60} value={count} onChange={(e) => setCount(e.target.value)} className={`${field} w-20`} />
      </label>
      <label className="flex flex-col gap-1">
        <span className={small}>Students each</span>
        <input type="number" min={1} max={1000} value={strength} onChange={(e) => setStrength(e.target.value)} className={`${field} w-24`} />
      </label>
      <button type="submit" className="rounded-full bg-ink px-3 py-1.5 text-[13px] font-medium text-paper">
        Add
      </button>
      <button type="button" onClick={() => setOpen(false)} className="rounded-full px-3 py-1.5 text-[13px] text-muted hover:text-ink">
        Cancel
      </button>
      {tried && problem && (
        <p role="alert" className="basis-full text-[13px] text-vermilion">
          {problem}
        </p>
      )}
    </form>
  )
}

function ProgrammeRow({ college, p, edit }: { college: CollegeData; p: Programme; edit: Edit }) {
  const sections = college.sections.filter((s) => s.programmeId === p.id)
  const subjects = college.subjects.filter((s) => s.programmeId === p.id).length
  return (
    <li className="rounded-lg border border-rule p-3">
      <div className="flex flex-wrap items-end gap-3">
        <TextField label="Programme" value={p.name} onCommit={(v) => edit((c) => updateProgramme(c, p.id, { name: v }))} className="w-60" />
        <span className="flex flex-col gap-1">
          <span className={small}>Short</span>
          <span className="py-1.5 font-mono text-[14px]">{p.shortName}</span>
        </span>
        <NumberField label="Sections" value={p.sectionsCount} min={1} max={60} onCommit={(n) => edit((c) => updateProgramme(c, p.id, { sectionsCount: n ?? 1 }))} />
        <NumberField
          label="Students each"
          value={p.defaultStrength}
          min={1}
          max={1000}
          className="w-24"
          onCommit={(n) => edit((c) => updateProgramme(c, p.id, { defaultStrength: n ?? 1 }))}
        />
        <button
          type="button"
          aria-label={`Remove ${p.name}`}
          onClick={() => window.confirm(`Remove ${p.name} with its ${sections.length} sections and ${subjects} subjects?`) && edit((c) => removeProgramme(c, p.id))}
          className="ml-auto rounded-full p-2 text-muted hover:bg-ink/5 hover:text-vermilion"
        >
          <Trash2 size={15} aria-hidden />
        </button>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
        {sections.map((s) => (
          <span key={s.id} className="rounded-full border border-rule px-2 py-0.5 font-mono text-ink">
            {s.name} · {s.strength}
          </span>
        ))}
        <span>· {subjects} subjects</span>
      </p>
      <details className="mt-2">
        <summary className="cursor-pointer text-[13px] text-muted hover:text-ink">Breaks for {p.shortName}{p.breaks ? ' (own)' : ''}</summary>
        <div className="mt-2">
          <BreakEditor calendar={college.calendar} rules={p.breaks} inheritFrom="its department" onChange={(rules) => edit((c) => setBreaks(c, 'programme', p.id, rules))} />
        </div>
      </details>
    </li>
  )
}

/** Departments and their programmes (years): sections count and students per section → sections generated. */
export function DepartmentsTab({ college, edit }: Props) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [tried, setTried] = useState(false)
  const problem = deptCodeProblem(college, code)

  return (
    <div className="space-y-6">
      {college.departments.map((d) => {
        const blocker = removeDepartmentProblem(college, d.id)
        return (
          <section key={d.id} aria-label={d.name} className="rounded-xl border border-rule bg-card p-4">
            <div className="flex flex-wrap items-end gap-3">
              <span className="rounded-full border border-ink px-2 py-1 font-mono text-[12px]">{d.code}</span>
              <TextField label="Department" value={d.name} onCommit={(v) => edit((c) => renameDepartment(c, d.id, v))} className="w-72" />
              <button
                type="button"
                aria-label={`Remove ${d.name}`}
                title={blocker ?? `Remove ${d.name}`}
                disabled={!!blocker}
                onClick={() => window.confirm(`Remove ${d.name} with all its programmes, sections and subjects?`) && edit((c) => removeDepartment(c, d.id))}
                className="ml-auto rounded-full p-2 text-muted hover:bg-ink/5 hover:text-vermilion disabled:opacity-30"
              >
                <Trash2 size={15} aria-hidden />
              </button>
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-[13px] text-muted hover:text-ink">Breaks for {d.code}{d.breaks ? ' (own)' : ''}</summary>
              <div className="mt-2">
                <BreakEditor calendar={college.calendar} rules={d.breaks} inheritFrom="the college" onChange={(rules) => edit((c) => setBreaks(c, 'department', d.id, rules))} />
              </div>
            </details>
            <ul className="mt-3 space-y-3">
              {college.programmes
                .filter((p) => p.deptId === d.id)
                .map((p) => (
                  <ProgrammeRow key={p.id} college={college} p={p} edit={edit} />
                ))}
            </ul>
            <div className="mt-3">
              <AddProgramme college={college} dept={d} edit={edit} />
            </div>
          </section>
        )
      })}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          setTried(true)
          if (problem) return
          edit((c) => addDepartment(c, code, name))
          setCode('')
          setName('')
          setTried(false)
        }}
        aria-label="Add a department"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-rule p-4"
      >
        <label className="flex flex-col gap-1">
          <span className={small}>Code</span>
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CIV" className={`${field} w-24 font-mono`} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={small}>Department name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Civil Engineering" className={`${field} w-64`} />
        </label>
        <button type="submit" className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-[13px] font-medium text-paper">
          <Plus size={14} aria-hidden /> Add department
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
