import { summarizeCollege } from '../../lib/structure'
import type { CollegeData } from '../../types'
import { PortalTitle } from '../PortalTitle'

type Props = { colleges: CollegeData[] }

/** Super Admin: every college on the platform, read-only status. Create / clone / archive and the
 *  Structure Builder arrive in P0.4-b and P0.4-c. */
export function SuperPortal({ colleges }: Props) {
  const active = colleges.filter((c) => c.college.status === 'active').length
  return (
    <section className="py-8">
      <PortalTitle role="superAdmin" title="All colleges">
        {colleges.length} {colleges.length === 1 ? 'college' : 'colleges'} on the platform · {active} active. You shape each
        college's structure; its College Admin builds and publishes the timetable.
      </PortalTitle>

      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {colleges.map((c) => {
          const s = summarizeCollege(c)
          const archived = c.college.status === 'archived'
          return (
            <li key={c.college.id} className={`rounded-xl border border-rule bg-card p-5 ${archived ? 'opacity-70' : ''}`}>
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
              <p className="mt-3 text-[13px] text-muted">
                {s.departments.length} departments · {s.sections} sections · {s.students} students · {s.subjects} subjects ·{' '}
                {s.teachers} teachers · {s.rooms} rooms
              </p>
              <p className="mt-1 text-[13px] text-muted">
                {s.dayRange} · {s.slotsPerDay} slots a day · {s.semester.name}
              </p>
              <p className="mt-3 border-t border-rule pt-3 text-[13px]">
                Timetable:{' '}
                <span className="font-medium">
                  {c.published ? `published v${c.published.version}` : 'not published'}
                  {c.draft ? ' · draft ready' : ''}
                </span>
              </p>
            </li>
          )
        })}
      </ul>

      <p className="mt-6 rounded-lg border border-dashed border-rule p-4 text-[13px] text-muted">
        Next on this desk: create, clone and archive colleges, then the Structure Builder (calendar, departments, programmes,
        sections and subjects).
      </p>
    </section>
  )
}
