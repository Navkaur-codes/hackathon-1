import { useState } from 'react'
import { Archive, ArchiveRestore, ArrowRight, Eye, Plus, Shapes, UserCog } from 'lucide-react'
import { setArchived, setCollegeAdmins } from '../../lib/edit'
import { summarizeCollege } from '../../lib/structure'
import { describeTimetable } from '../../solver/best'
import { useKaal } from '../../store'
import type { CollegeData, Id } from '../../types'
import { PortalTitle } from '../PortalTitle'
import { NewCollegeForm } from './NewCollegeForm'

type Props = {
  colleges: CollegeData[]
  onView: (collegeId: Id) => void
  /** Step into a college as its College Admin. */
  onOpenAsAdmin: (collegeId: Id) => void
  onOpenStructure: (collegeId: Id) => void
}

const btn = 'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition'

function AdminNames({ college }: { college: CollegeData }) {
  const updateCollege = useKaal((s) => s.updateCollege)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const names = college.college.collegeAdminIds
  if (!editing)
    return (
      <p className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="text-muted">College Admins:</span>
        <span>{names.length ? names.join(', ') : <em className="text-muted">none yet</em>}</span>
        <button
          type="button"
          onClick={() => {
            setText(names.join(', '))
            setEditing(true)
          }}
          className="inline-flex items-center gap-1 text-[12px] text-muted underline-offset-2 hover:text-ink hover:underline"
        >
          <UserCog size={13} aria-hidden /> Edit
        </button>
      </p>
    )
  const save = () => {
    updateCollege(college.college.id, (c) => setCollegeAdmins(c, text.split(',')))
    setEditing(false)
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <label className="min-w-0 flex-1">
        <span className="sr-only">College Admin names, separated by commas</span>
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
          placeholder="Names, separated by commas"
          className="w-full rounded-lg border border-rule bg-paper px-3 py-1.5 text-[13px]"
        />
      </label>
      <button type="submit" className={`${btn} border-ink bg-ink text-paper`}>
        Save
      </button>
      <button type="button" onClick={() => setEditing(false)} className={`${btn} border-rule`}>
        Cancel
      </button>
    </form>
  )
}

/** Super Admin: every college on the platform — create, clone, archive, admins and read-only status. */
export function SuperPortal({ colleges, onView, onOpenAsAdmin, onOpenStructure }: Props) {
  const addCollege = useKaal((s) => s.addCollege)
  const updateCollege = useKaal((s) => s.updateCollege)
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<CollegeData | null>(null)
  const active = colleges.filter((c) => c.college.status === 'active').length

  const toggleArchive = (c: CollegeData) => {
    const archive = c.college.status === 'active'
    if (archive && !window.confirm(`Archive ${c.college.name}? Its admins, teachers and students lose access until you restore it.`)) return
    updateCollege(c.college.id, (x) => setArchived(x, archive))
  }

  return (
    <section className="py-8">
      <PortalTitle role="superAdmin" title="All colleges">
        {colleges.length} {colleges.length === 1 ? 'college' : 'colleges'} on the platform · {active} active. You create and shape
        colleges; each College Admin builds and publishes their own timetable.
      </PortalTitle>

      <div className="mt-6">
        {creating ? (
          <NewCollegeForm
            colleges={colleges}
            onCancel={() => setCreating(false)}
            onCreate={(c) => {
              addCollege(c)
              setCreating(false)
              setCreated(c)
            }}
          />
        ) : (
          <button type="button" onClick={() => setCreating(true)} className={`${btn} border-ink bg-ink text-paper hover:opacity-90`}>
            <Plus size={15} aria-hidden /> New college
          </button>
        )}
        {created && !creating && (
          <div role="status" className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-plum/40 bg-plum/5 px-4 py-3 text-[13px]">
            <span>
              <strong>{created.college.name}</strong> ({created.college.code}) is on the platform.
            </span>
            <button type="button" onClick={() => onOpenStructure(created.college.id)} className={`${btn} border-ink bg-ink text-paper hover:opacity-90`}>
              <Shapes size={14} aria-hidden /> Shape its structure
            </button>
            <button type="button" onClick={() => onOpenAsAdmin(created.college.id)} className={`${btn} border-ink hover:bg-ink hover:text-paper`}>
              Open as its College Admin <ArrowRight size={14} aria-hidden />
            </button>
          </div>
        )}
      </div>

      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {colleges.map((c) => {
          const s = summarizeCollege(c)
          const archived = c.college.status === 'archived'
          // read-only status from the college's stored draft (recomputed, never trusted from storage)
          const r = c.draft ? describeTimetable(c, c.draft) : undefined
          return (
            <li
              key={c.college.id}
              className={`flex flex-col gap-3 rounded-xl border bg-card p-5 ${
                created?.college.id === c.college.id ? 'border-plum' : 'border-rule'
              } ${archived ? 'opacity-75' : ''}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-mono text-[11px] tracking-[0.2em] text-muted uppercase">{c.college.code}</span>
                  <h2 className="font-display text-lg leading-snug font-semibold">{c.college.name}</h2>
                </div>
                <span
                  className="rounded-full border px-2 py-0.5 font-mono text-[11px] uppercase"
                  style={{ color: archived ? 'var(--muted)' : 'var(--plum)', borderColor: archived ? 'var(--rule)' : 'var(--plum)' }}
                >
                  {c.college.status}
                </span>
              </div>
              <p className="text-[13px] text-muted">
                {s.departments.length} departments · {s.sections} sections · {s.students} students · {s.subjects} subjects ·{' '}
                {s.teachers} teachers · {s.rooms} rooms
                <br />
                {s.dayRange} · {s.slotsPerDay} slots a day · {s.semester.name}
              </p>
              <AdminNames college={c} />
              <p className="border-t border-rule pt-3 text-[13px]">
                <span className="text-muted">Timetable: </span>
                {c.published ? `published v${c.published.version}` : 'not published'}
                {r
                  ? ` · draft: ${r.conflicts.length === 0 ? '0 clashes' : `${r.conflicts.length} clashes`}, quality ${r.score.total}/100${
                      r.unplacedPeriods ? `, ${r.unplacedPeriods} not placed` : ''
                    }${c.draftStale ? ' (out of date)' : ''}`
                  : ' · no draft yet (the College Admin generates it)'}
              </p>
              <div className="mt-auto flex flex-wrap gap-2">
                <button type="button" onClick={() => onOpenStructure(c.college.id)} className={`${btn} border-ink bg-ink text-paper hover:opacity-90`}>
                  <Shapes size={14} aria-hidden /> Structure
                </button>
                {r && (
                  <button type="button" onClick={() => onView(c.college.id)} className={`${btn} border-rule hover:border-ink`}>
                    <Eye size={14} aria-hidden /> View timetable
                  </button>
                )}
                {!archived && (
                  <button type="button" onClick={() => onOpenAsAdmin(c.college.id)} className={`${btn} border-rule hover:border-ink`}>
                    Open as College Admin <ArrowRight size={14} aria-hidden />
                  </button>
                )}
                <button type="button" onClick={() => toggleArchive(c)} className={`${btn} border-rule hover:border-ink`}>
                  {archived ? (
                    <>
                      <ArchiveRestore size={14} aria-hidden /> Restore
                    </>
                  ) : (
                    <>
                      <Archive size={14} aria-hidden /> Archive
                    </>
                  )}
                </button>
              </div>
            </li>
          )
        })}
      </ul>

    </section>
  )
}
