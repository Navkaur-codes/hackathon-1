import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { NumberField, TextField } from '../../../components/fields'
import { addRoom, removeRoom, roomProblem, updateRoom } from '../../../lib/edit'
import type { CollegeData, Id, RoomType } from '../../../types'
import type { Edit } from './tabs'

const TYPES: { value: RoomType; label: string }[] = [
  { value: 'lecture', label: 'Lecture room' },
  { value: 'lab', label: 'Lab' },
  { value: 'seminar', label: 'Seminar hall' },
]
const field = 'rounded-lg border border-rule bg-paper px-2 py-1.5 text-[14px]'
const small = 'font-mono text-[11px] tracking-[0.15em] text-muted uppercase'

function OwnerSelect({ college, value, onChange, label }: { college: CollegeData; value: string; onChange: (v: string) => void; label: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className={small}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={field}>
        <option value="shared">Shared — every department</option>
        {college.departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.code} only
          </option>
        ))}
      </select>
    </label>
  )
}

/** Department rooms and shared rooms (the College Admin owns shared rooms, root §2). On an HOD desk: the department's own rooms. */
export function RoomsTab({ college, edit, deptId }: { college: CollegeData; edit: Edit; deptId?: Id }) {
  const [draft, setDraft] = useState({ name: '', type: 'lecture' as RoomType, capacity: '60', owner: deptId ?? 'shared' })
  const rooms = deptId ? college.rooms.filter((r) => r.owner === deptId) : college.rooms
  const [tried, setTried] = useState(false)
  const problem = roomProblem(college, draft.name)
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted">
        {deptId
          ? 'Rooms your department owns. Shared rooms are set up by the College Admin; another department\u2019s room can be borrowed through Room Exchange.'
          : 'A section may use its own department\u2019s rooms and shared rooms. Another department\u2019s room needs a loan through Room Exchange.'}
      </p>
      <ul className="space-y-2">
        {rooms.map((r) => (
          <li key={r.id} className="flex flex-wrap items-end gap-3 rounded-lg border border-rule p-3">
            <TextField
              label="Room"
              value={r.name}
              className="w-40"
              onCommit={(v) => !roomProblem(college, v, r.id) && edit((c) => updateRoom(c, r.id, { name: v }))}
            />
            <label className="flex flex-col gap-1">
              <span className={small}>Type</span>
              <select value={r.type} onChange={(e) => edit((c) => updateRoom(c, r.id, { type: e.target.value as RoomType }))} className={field}>
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <NumberField label="Seats" value={r.capacity} min={1} max={2000} onCommit={(n) => edit((c) => updateRoom(c, r.id, { capacity: n ?? 1 }))} />
            {!deptId && <OwnerSelect college={college} label="Used by" value={r.owner} onChange={(owner) => edit((c) => updateRoom(c, r.id, { owner }))} />}
            <button
              type="button"
              aria-label={`Remove ${r.name}`}
              onClick={() => window.confirm(`Remove ${r.name}?`) && edit((c) => removeRoom(c, r.id))}
              className="ml-auto rounded-full p-2 text-muted hover:bg-ink/5 hover:text-vermilion"
            >
              <Trash2 size={15} aria-hidden />
            </button>
          </li>
        ))}
        {rooms.length === 0 && <li className="text-[13px] text-muted">No rooms yet.</li>}
      </ul>
      <form
        aria-label="Add a room"
        onSubmit={(e) => {
          e.preventDefault()
          setTried(true)
          if (problem) return
          edit((c) => addRoom(c, { name: draft.name, type: draft.type, capacity: Number(draft.capacity), owner: draft.owner }))
          setDraft({ ...draft, name: '' })
          setTried(false)
        }}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-rule p-3"
      >
        <label className="flex flex-col gap-1">
          <span className={small}>Room</span>
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="LT-101" className={`${field} w-40`} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={small}>Type</span>
          <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as RoomType })} className={field}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={small}>Seats</span>
          <input type="number" min={1} value={draft.capacity} onChange={(e) => setDraft({ ...draft, capacity: e.target.value })} className={`${field} w-20`} />
        </label>
        {!deptId && <OwnerSelect college={college} label="Used by" value={draft.owner} onChange={(owner) => setDraft({ ...draft, owner })} />}
        <button type="submit" className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-[13px] font-medium text-paper">
          <Plus size={14} aria-hidden /> Add room
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
