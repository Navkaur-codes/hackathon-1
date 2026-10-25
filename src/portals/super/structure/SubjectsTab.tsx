import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { NumberField, TextField } from '../../../components/fields'
import { addSubject, removeSubject, subjectProblem, updateSubject } from '../../../lib/edit'
import type { CollegeData, Id, RoomType, SubjectKind } from '../../../types'

type Props = { college: CollegeData; edit: (fn: (c: CollegeData) => CollegeData) => void }

const ROOM_TYPES: { value: RoomType; label: string }[] = [
  { value: 'lecture', label: 'Lecture room' },
  { value: 'lab', label: 'Lab' },
  { value: 'seminar', label: 'Seminar hall' },
]
const field = 'rounded-lg border border-rule bg-paper px-2 py-1.5 text-[14px]'

/** The curriculum of each programme (rule G5): every section of the programme takes these subjects. */
export function SubjectsTab({ college, edit }: Props) {
  const [programmeId, setProgrammeId] = useState<Id>(college.programmes[0]?.id ?? '')
  const programme = college.programmes.find((p) => p.id === programmeId) ?? college.programmes[0]
  const [draft, setDraft] = useState({ code: '', name: '', kind: 'theory' as SubjectKind, periods: '4' })
  const [tried, setTried] = useState(false)
  if (!programme) return <p className="text-[14px] text-muted">Add a department and a programme first (Departments tab).</p>

  const subjects = college.subjects.filter((s) => s.programmeId === programme.id)
  const total = subjects.reduce((sum, s) => sum + s.periodsPerWeek, 0)
  const problem = subjectProblem(college, programme.id, draft.code)

  return (
    <div className="space-y-4">
      <label className="flex flex-wrap items-center gap-2 text-[14px]">
        <span className="font-mono text-[11px] tracking-[0.15em] text-muted uppercase">Programme</span>
        <select value={programme.id} onChange={(e) => setProgrammeId(e.target.value)} className={`${field} min-w-0`}>
          {college.departments.map((d) => (
            <optgroup key={d.id} label={d.name}>
              {college.programmes
                .filter((p) => p.deptId === d.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <span className="text-[13px] text-muted">
          {subjects.length} subjects · {total} periods a week for each of its {college.sections.filter((s) => s.programmeId === programme.id).length} sections
        </span>
      </label>

      <ul className="space-y-2">
        {subjects.map((s) => (
          <li key={s.id} className="flex flex-wrap items-end gap-3 rounded-lg border border-rule p-3">
            <span className="flex flex-col gap-1">
              <span className="font-mono text-[11px] tracking-[0.15em] text-muted uppercase">Code</span>
              <span className="w-16 py-1.5 font-mono text-[14px]">{s.code}</span>
            </span>
            <TextField label="Name" value={s.name} onCommit={(v) => edit((c) => updateSubject(c, s.id, { name: v }))} className="w-56" />
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[11px] tracking-[0.15em] text-muted uppercase">Kind</span>
              <select
                value={s.kind}
                onChange={(e) => {
                  const kind = e.target.value as SubjectKind
                  edit((c) => updateSubject(c, s.id, { kind, roomType: kind === 'lab' ? 'lab' : s.roomType === 'lab' ? 'lecture' : s.roomType }))
                }}
                className={field}
              >
                <option value="theory">Theory</option>
                <option value="lab">Lab</option>
              </select>
            </label>
            <NumberField label="Periods / week" value={s.periodsPerWeek} min={1} max={40} onCommit={(n) => edit((c) => updateSubject(c, s.id, { periodsPerWeek: n ?? 1 }))} />
            {s.kind === 'lab' && (
              <NumberField
                label="Block (slots)"
                value={s.blockLength}
                allowEmpty
                min={1}
                max={college.calendar.periodsPerDay}
                hint={s.blockLength ? undefined : `college default ${college.calendar.labBlockLength}`}
                onCommit={(n) => edit((c) => updateSubject(c, s.id, { blockLength: n }))}
              />
            )}
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[11px] tracking-[0.15em] text-muted uppercase">Room</span>
              <select value={s.roomType} onChange={(e) => edit((c) => updateSubject(c, s.id, { roomType: e.target.value as RoomType }))} className={field}>
                {ROOM_TYPES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              aria-label={`Remove ${s.name}`}
              onClick={() => window.confirm(`Remove ${s.name} from ${programme.name}? Its teacher choices go too.`) && edit((c) => removeSubject(c, s.id))}
              className="ml-auto rounded-full p-2 text-muted hover:bg-ink/5 hover:text-vermilion"
            >
              <Trash2 size={15} aria-hidden />
            </button>
          </li>
        ))}
        {subjects.length === 0 && <li className="text-[13px] text-muted">No subjects yet.</li>}
      </ul>

      <form
        aria-label="Add a subject"
        onSubmit={(e) => {
          e.preventDefault()
          setTried(true)
          if (problem) return
          edit((c) =>
            addSubject(c, programme.id, {
              code: draft.code,
              name: draft.name,
              kind: draft.kind,
              periodsPerWeek: Number(draft.periods),
              roomType: draft.kind === 'lab' ? 'lab' : 'lecture',
            }),
          )
          setDraft({ code: '', name: '', kind: 'theory', periods: '4' })
          setTried(false)
        }}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-rule p-3"
      >
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[11px] tracking-[0.15em] text-muted uppercase">Code</span>
          <input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} placeholder="DS" className={`${field} w-20 font-mono`} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[11px] tracking-[0.15em] text-muted uppercase">Name</span>
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Data Structures" className={`${field} w-56`} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[11px] tracking-[0.15em] text-muted uppercase">Kind</span>
          <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as SubjectKind })} className={field}>
            <option value="theory">Theory</option>
            <option value="lab">Lab</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[11px] tracking-[0.15em] text-muted uppercase">Periods / week</span>
          <input type="number" min={1} max={40} value={draft.periods} onChange={(e) => setDraft({ ...draft, periods: e.target.value })} className={`${field} w-20`} />
        </label>
        <button type="submit" className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-[13px] font-medium text-paper">
          <Plus size={14} aria-hidden /> Add subject
        </button>
        {tried && problem && (
          <p role="alert" className="basis-full text-[13px] text-vermilion">
            {problem}
          </p>
        )}
      </form>
      <p className="text-[12px] text-muted">New subjects start without a teacher — the College Admin picks one per section in their setup.</p>
    </div>
  )
}
