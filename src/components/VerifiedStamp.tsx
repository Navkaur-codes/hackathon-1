import { AlertTriangle, BadgeCheck } from 'lucide-react'

/** The "0 clashes — verified" stamp, driven by the independent validator's result. */
export function VerifiedStamp({ conflicts, className = '' }: { conflicts: number; className?: string }) {
  const clean = conflicts === 0
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border-2 px-2.5 py-1 font-mono text-[11px] font-semibold tracking-wider uppercase ${
        clean ? 'border-ink text-ink' : 'border-vermilion text-vermilion'
      } ${className}`}
    >
      {clean ? <BadgeCheck size={14} aria-hidden /> : <AlertTriangle size={14} aria-hidden />}
      {clean ? '0 clashes — verified' : `${conflicts} ${conflicts === 1 ? 'clash' : 'clashes'} found`}
    </span>
  )
}
