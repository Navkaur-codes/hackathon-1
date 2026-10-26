import { describeSlots } from '../../lib/exchange'
import type { CollegeData, Grant } from '../../types'

const STATUS: Record<Grant['status'], string> = {
  requested: 'asked',
  offered: 'offered',
  approved: 'on loan',
  rejected: 'declined',
  revoked: 'taken back',
}

/** Every room loan between departments (read-only): the College Admin sees the whole Room Exchange. */
export function LoanLedger({ college }: { college: CollegeData }) {
  const code = (id: string) => college.departments.find((d) => d.id === id)?.code ?? id
  const room = (id: string) => college.rooms.find((r) => r.id === id)?.name ?? id
  const loans = [...college.grants].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  const live = loans.filter((g) => g.status === 'approved').length
  return (
    <section aria-labelledby="ledger-h" className="rounded-xl border border-rule bg-card p-5">
      <h2 id="ledger-h" className="font-display text-base font-semibold">
        Rooms across departments
      </h2>
      <p className="text-[12px] text-muted">
        {loans.length === 0
          ? 'No room used across departments yet. Your whole-college generate may allocate any department’s room for the semester; HODs arrange weekly loans.'
          : `${live} in use now (your semester allocations + HOD loans) · ${loans.length} in total.`}
      </p>
      {loans.length > 0 && (
        <ul className="mt-2 divide-y divide-rule">
          {loans.map((g) => (
            <li key={g.id} className="flex flex-wrap gap-x-3 py-1.5 text-[13px]">
              <span className="w-20 font-mono text-[11px] text-muted uppercase">{g.kind === 'allocation' ? 'allocated' : STATUS[g.status]}</span>
              <span className="min-w-0 flex-1">
                {room(g.roomId)} · {code(g.fromDeptId)} → {code(g.toDeptId)} · {describeSlots(college, g.slots)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
