import type { ReactNode } from 'react'
import type { Role } from '../types'
import { roleMeta } from '../components/roles'

/** Eyebrow in the role's accent colour + page title, shared by every portal. */
export function PortalTitle({ role, title, children }: { role: Role; title: string; children?: ReactNode }) {
  const meta = roleMeta(role)
  const Icon = meta.icon
  return (
    <header className="border-b border-rule pb-5">
      <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] uppercase" style={{ color: meta.accent }}>
        <Icon size={14} aria-hidden /> {meta.name}
      </p>
      <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      {children && <div className="mt-1 text-[14px] text-muted">{children}</div>}
    </header>
  )
}
