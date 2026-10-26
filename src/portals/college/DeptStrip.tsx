import { readiness } from '../../lib/deptPlan'
import type { CollegeData } from '../../types'

/** Each department's Draft / Ready status and what still holds it back — HODs mark Ready, the College Admin publishes. */
export function DeptStrip({ college }: { college: CollegeData }) {
  if (college.departments.length === 0) return null
  return (
    <section aria-labelledby="depts-h" className="rounded-xl border border-rule bg-card p-5">
      <h2 id="depts-h" className="font-display text-base font-semibold">
        Departments
      </h2>
      <ul className="mt-3 divide-y divide-rule">
        {college.departments.map((d) => {
          const r = readiness(college, d.id)
          const open = r.items.filter((i) => !i.ok)
          const ready = d.status === 'ready'
          return (
            <li key={d.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 text-[13px]">
              <span className="w-12 font-mono text-[12px]">{d.code}</span>
              <span
                className="rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase"
                style={{ color: ready ? 'var(--plum)' : 'var(--terracotta)', borderColor: ready ? 'var(--plum)' : 'var(--terracotta)' }}
              >
                {ready ? 'Ready' : 'Draft'}
              </span>
              <span className={`min-w-0 flex-1 ${open.length ? 'text-muted' : ''}`}>
                {open.length === 0 ? 'Every check passes.' : open.map((i) => i.label.toLowerCase()).join(' · ') + ' — still open'}
              </span>
            </li>
          )
        })}
      </ul>
      <p className="mt-2 text-[12px] text-muted">HODs mark their department Ready. You can still publish when some are not — you will see it here.</p>
    </section>
  )
}
