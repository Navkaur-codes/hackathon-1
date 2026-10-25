import type { Role } from '../types'
import { ROLES } from './roles'

type Props = { role: Role; onRole: (r: Role) => void }

/** Stand-in for logging in (until v0.9): pick which desk you sit at. Chips on wide screens, a select on phones. */
export function RoleSwitcher({ role, onRole }: Props) {
  return (
    <>
      <div role="radiogroup" aria-label="Role" className="hidden items-center gap-1 lg:flex">
        {ROLES.map((r) => {
          const on = r.role === role
          return (
            <button
              key={r.role}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onRole(r.role)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] font-medium transition ${
                on ? 'border-ink bg-ink text-paper' : 'border-rule text-ink hover:border-ink'
              }`}
            >
              <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: r.accent }} />
              {r.short}
            </button>
          )
        })}
      </div>
      <label className="lg:hidden">
        <span className="sr-only">Role</span>
        <select
          value={role}
          onChange={(e) => onRole(e.target.value as Role)}
          className="rounded-full border border-ink bg-card px-3 py-1.5 text-[13px] font-medium"
        >
          {ROLES.map((r) => (
            <option key={r.role} value={r.role}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
    </>
  )
}
