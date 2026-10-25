import { useMemo, useState } from 'react'
import { CircleAlert, ClipboardPaste, Upload } from 'lucide-react'
import { Chips } from '../../../components/fields'
import { applyAssignments, applyRooms, applyTeachers, parseAssignments, parseRooms, parseTeachers } from '../../../lib/csv'
import type { CollegeData } from '../../../types'
import type { Edit } from './tabs'

type Kind = 'teachers' | 'rooms' | 'assignments'

const COLUMNS: Record<Kind, string> = {
  teachers: 'Name · Department (code or name) · Max periods a day · Max a week (last two optional)',
  rooms: 'Room · Type (lecture / lab / seminar) · Seats · Used by (department code, or blank = shared)',
  assignments: 'Section · Subject code · Teacher name',
}

/** An example built from this college's own departments, sections and subjects (never hard-coded, rule G2). */
function example(kind: Kind, c: CollegeData): string {
  const d = c.departments[0]?.code ?? 'DEPT'
  if (kind === 'teachers') return `Name\tDepartment\tMax/day\tMax/week\nDr. Example Teacher\t${d}\t4\t16\nProf. Second Teacher\t${d}\t3\t12`
  if (kind === 'rooms') return `Room\tType\tSeats\tUsed by\nLT-901\tlecture\t60\t${d}\nLab-901\tlab\t60\t\nHall-9\tseminar\t150\tshared`
  const rows = c.assignments.slice(0, 3).map((a) => {
    const s = c.sections.find((x) => x.id === a.sectionId)
    const sub = c.subjects.find((x) => x.id === a.subjectId)
    const t = c.teachers.find((x) => x.id === a.teacherId) ?? c.teachers[0]
    return `${s?.name}\t${sub?.code}\t${t?.name ?? 'Teacher name'}`
  })
  return ['Section\tSubject\tTeacher', ...rows].join('\n')
}

/** Paste rows copied from Excel / Google Sheets (or CSV): preview good rows and errors, then import. */
export function PasteTab({ college, edit }: { college: CollegeData; edit: Edit }) {
  const [kind, setKind] = useState<Kind>('teachers')
  const [text, setText] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const parsed = useMemo(() => {
    if (!text.trim()) return null
    if (kind === 'teachers') return { kind, ...parseTeachers(text, college) }
    if (kind === 'rooms') return { kind, ...parseRooms(text, college) }
    return { kind, ...parseAssignments(text, college) }
  }, [kind, text, college])

  const describe = (row: unknown): string => {
    if (kind === 'teachers') {
      const t = row as ReturnType<typeof parseTeachers>['rows'][number]['value']
      return `${t.name} · ${college.departments.find((d) => d.id === t.deptId)?.code} · ${t.maxPerDay}/day, ${t.maxPerWeek}/week`
    }
    if (kind === 'rooms') {
      const r = row as ReturnType<typeof parseRooms>['rows'][number]['value']
      return `${r.name} · ${r.type} · ${r.capacity} seats · ${r.owner === 'shared' ? 'shared' : college.departments.find((d) => d.id === r.owner)?.code}`
    }
    return (row as ReturnType<typeof parseAssignments>['rows'][number]['value']).label
  }

  const doImport = () => {
    if (!parsed || parsed.rows.length === 0) return
    const n = parsed.rows.length
    if (parsed.kind === 'teachers') edit((c) => applyTeachers(c, parsed.rows.map((r) => r.value)))
    else if (parsed.kind === 'rooms') edit((c) => applyRooms(c, parsed.rows.map((r) => r.value)))
    else edit((c) => applyAssignments(c, parsed.rows.map((r) => r.value)))
    setDone(`Imported ${n} ${kind === 'assignments' ? (n === 1 ? 'teacher choice' : 'teacher choices') : n === 1 ? kind.slice(0, -1) : kind}.${parsed.errors.length ? ` ${parsed.errors.length} ${parsed.errors.length === 1 ? 'row' : 'rows'} with problems ${parsed.errors.length === 1 ? 'was' : 'were'} left out.` : ''}`)
    setText('')
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Chips
          label="What are you pasting?"
          options={[
            { value: 'teachers', label: 'Teachers' },
            { value: 'rooms', label: 'Rooms' },
            { value: 'assignments', label: 'Who teaches what' },
          ]}
          selected={[kind]}
          onToggle={(k) => {
            setKind(k as Kind)
            setDone(null)
          }}
        />
        <button type="button" onClick={() => setText(example(kind, college))} className="text-[13px] text-muted underline-offset-2 hover:text-ink hover:underline">
          Fill an example
        </button>
      </div>
      <p className="text-[13px] text-muted">
        Columns: <span className="text-ink">{COLUMNS[kind]}</span>. Copy the cells in Excel or Google Sheets and paste here — tabs or commas both work, a
        header row is optional.
      </p>
      <label className="block">
        <span className="sr-only">Pasted rows</span>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setDone(null)
          }}
          rows={7}
          spellCheck={false}
          placeholder="Paste here…"
          className="w-full rounded-lg border border-rule bg-paper p-3 font-mono text-[13px]"
        />
      </label>

      {done && (
        <p role="status" className="flex items-center gap-2 text-[13px]">
          <ClipboardPaste size={15} className="text-plum" aria-hidden /> {done}
        </p>
      )}

      {parsed && (
        <div className="grid gap-3 md:grid-cols-2" aria-live="polite">
          <div className="rounded-lg border border-rule p-3">
            <p className="font-mono text-[11px] tracking-[0.15em] text-muted uppercase">Ready to import · {parsed.rows.length}</p>
            <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto text-[13px]">
              {parsed.rows.map((r) => (
                <li key={r.line}>
                  <span className="mr-2 font-mono text-[11px] text-muted">line {r.line}</span>
                  {describe(r.value)}
                </li>
              ))}
              {parsed.rows.length === 0 && <li className="text-muted">Nothing usable yet.</li>}
            </ul>
          </div>
          <div className="rounded-lg border border-rule p-3">
            <p className="font-mono text-[11px] tracking-[0.15em] text-muted uppercase">Problems · {parsed.errors.length}</p>
            <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto text-[13px]">
              {parsed.errors.map((e) => (
                <li key={e.line} className="flex gap-2">
                  <CircleAlert size={14} className="mt-0.5 shrink-0 text-vermilion" aria-hidden />
                  <span>
                    <span className="mr-1 font-mono text-[11px] text-muted">line {e.line}</span>
                    {e.message}
                  </span>
                </li>
              ))}
              {parsed.errors.length === 0 && <li className="text-muted">None.</li>}
            </ul>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={doImport}
        disabled={!parsed || parsed.rows.length === 0}
        className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:opacity-90 disabled:opacity-40"
      >
        <Upload size={15} aria-hidden /> Import {parsed?.rows.length ?? 0} {parsed?.rows.length === 1 ? 'row' : 'rows'}
      </button>
    </div>
  )
}
