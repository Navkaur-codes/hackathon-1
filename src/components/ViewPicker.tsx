import type { EntityGroup, GridView } from '../lib/gridModel'
import type { Id } from '../types'

const VIEWS: { id: GridView; label: string }[] = [
  { id: 'section', label: 'Section' },
  { id: 'teacher', label: 'Teacher' },
  { id: 'room', label: 'Room' },
]

type Props = {
  view: GridView
  entityId: Id
  groups: EntityGroup[]
  onView: (v: GridView) => void
  onEntity: (id: Id) => void
}

/** Section / Teacher / Room switch + a picker grouped by department. */
export function ViewPicker({ view, entityId, groups, onView, onEntity }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div role="tablist" aria-label="Timetable view" className="inline-flex rounded-full border border-ink p-0.5">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            role="tab"
            type="button"
            aria-selected={view === v.id}
            onClick={() => onView(v.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              view === v.id ? 'bg-ink text-paper' : 'text-ink hover:bg-ink/5'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
      <label className="flex min-w-0 basis-full items-center gap-2 text-sm sm:basis-auto">
        <span className="sr-only">Choose a {view}</span>
        <select
          value={entityId}
          onChange={(e) => onEntity(e.target.value)}
          className="w-full min-w-0 rounded-full border border-rule bg-card px-4 py-2 text-sm sm:w-72"
        >
          {groups.map((g) => (
            <optgroup key={g.group} label={g.group}>
              {g.items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
    </div>
  )
}
