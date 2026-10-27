import { useEffect, useState } from 'react'
import { Check, CircleAlert, Copy, ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { fetchLiveIndex, liveUrl, pushLive, withPublishKey } from '../lib/liveLinks'
import { collegeKey, publicUrl } from '../lib/publicView'
import type { CollegeData, Department } from '../types'

type Props = {
  college: CollegeData
  departments: Department[]
  /** Present on the College Admin's desk: may store the published version so the links show it. */
  edit?: (fn: (c: CollegeData) => CollegeData) => void
}

type Live = 'checking' | 'live' | 'updating' | 'stale' | { offline: string }

const btn = 'inline-flex items-center gap-1.5 rounded-full border border-rule px-2.5 py-1 text-[12px] font-medium transition hover:border-ink'

/**
 * Each department's public link (v0.9-d; live since v0.9-l). When Kaalchakra's storage holds the published version
 * the link is permanent (`#/t/<college>/<dept>`) and every publish updates what it shows; otherwise (local dev, or
 * storage not set up) the one-time snapshot link is offered instead.
 */
export function PublicLinks({ college, departments, edit }: Props) {
  const pub = college.published
  const [live, setLive] = useState<Live>('checking')
  const [copied, setCopied] = useState<string | null>(null)
  const version = pub?.version
  const at = pub?.at

  const push = async () => {
    setLive('updating')
    // a college published before live links gets its publish key now
    const keyed = withPublishKey(college)
    if (keyed !== college) edit?.(() => keyed)
    const r = await pushLive(keyed)
    setLive(r.ok ? 'live' : { offline: r.reason })
  }

  // is the stored version the one published here? if not (just published) the College Admin's desk stores it.
  // Callers key this component by version, so each publish starts again from 'checking'.
  useEffect(() => {
    if (!version) return
    let stop = false
    void fetchLiveIndex(collegeKey(college)).then((index) => {
      if (stop) return
      if (index === undefined) return setLive({ offline: 'Kaalchakra’s storage could not be reached (it runs only on the live site).' })
      if (index && index.version === version && index.at === at) return setLive('live')
      setLive('stale')
      if (edit) void push()
    })
    return () => {
      stop = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-check only when a new version is published
  }, [version, at])

  if (!pub) return null
  const base = `${window.location.origin}${window.location.pathname}`
  const permanent = live === 'live'
  const copy = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(id)
      window.setTimeout(() => setCopied((c) => (c === id ? null : c)), 2000)
    } catch {
      window.prompt('Copy this link:', url)
    }
  }

  return (
    <div className="mt-4 border-t border-rule pt-4">
      <h3 className="font-display text-[16px] font-semibold">Public links</h3>
      <p className="mt-0.5 text-[13px] text-muted">
        Anyone with a link sees that department’s faculty, UG / PG classes and rooms — no sign-in.{' '}
        {permanent ? `These links never change: each one shows the latest published version (now v${pub.version}).` : ''}
      </p>
      <p role="status" className="mt-1 flex items-center gap-1.5 text-[12px]">
        {live === 'checking' || live === 'updating' ? (
          <>
            <Loader2 size={13} className="animate-spin text-muted" aria-hidden /> {live === 'checking' ? 'Checking the live links…' : `Updating the live links to v${pub.version}…`}
          </>
        ) : live === 'live' ? (
          <>
            <Check size={13} className="text-plum" aria-hidden /> Live — version {pub.version}, updated {new Date(pub.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </>
        ) : live === 'stale' ? (
          <>
            <CircleAlert size={13} className="text-terracotta" aria-hidden /> The live links still show an older version{edit ? '' : ' — the College Admin updates them'}.
            {edit && (
              <button type="button" onClick={() => void push()} className={`${btn} ml-1`}>
                <RefreshCw size={12} aria-hidden /> Update
              </button>
            )}
          </>
        ) : (
          <>
            <CircleAlert size={13} className="text-terracotta" aria-hidden /> {live.offline} Below are one-time links that carry version {pub.version} — share them again after
            the next publish.
            {edit && (
              <button type="button" onClick={() => void push()} className={`${btn} ml-1`}>
                <RefreshCw size={12} aria-hidden /> Try again
              </button>
            )}
          </>
        )}
      </p>
      <ul className="mt-2 divide-y divide-rule">
        {departments.map((d) => {
          const url = permanent ? liveUrl(base, college, d) : publicUrl(base, college, d)
          if (!url) return null
          return (
            <li key={d.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="mr-auto min-w-0 text-[14px]">
                <span className="font-mono text-[12px] text-muted">{d.code}</span> {d.name}
                {permanent && <span className="block truncate font-mono text-[11px] text-muted">{url}</span>}
              </span>
              <button type="button" onClick={() => void copy(d.id, url)} className={btn} aria-label={`Copy the public link of ${d.name}`}>
                {copied === d.id ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />} {copied === d.id ? 'Copied' : 'Copy link'}
              </button>
              <a href={url} target="_blank" rel="noreferrer" className={btn} aria-label={`Open the public timetable of ${d.name}`}>
                <ExternalLink size={13} aria-hidden /> Open
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
