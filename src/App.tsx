import { useEffect, useState } from 'react'
import { LogOut } from 'lucide-react'
import { CollegeSwitcher } from './components/CollegeSwitcher'
import { Landing } from './components/Landing'
import { RoleSwitcher } from './components/RoleSwitcher'
import { TimetableView } from './components/TimetableView'
import { Wheel } from './components/Wheel'
import { can, collegeFor, switchableColleges } from './lib/access'
import { formatRoute, parseRoute, portalOf, type Route } from './lib/route'
import { viewFromSearch } from './lib/viewUrl'
import { ComingSoon } from './portals/ComingSoon'
import { CollegePortal } from './portals/college/CollegePortal'
import { SuperPortal } from './portals/super/SuperPortal'
import { StructureBuilder } from './portals/super/structure/StructureBuilder'
import { asBuilderTab } from './portals/super/structure/tabs'
import { asSetupTab } from './portals/college/setup/tabs'
import type { SolveResult } from './solver/best'
import { runSolver } from './solver/runSolver'
import { appStore, useKaal } from './store'
import type { CollegeData, Role } from './types'

// A shared link (?college=…&seed=…) reopens that exact timetable, view and filters.
const shared = (() => {
  const s = typeof window === 'undefined' ? null : viewFromSearch(window.location.search)
  return s && switchableColleges(appStore.getState().colleges).some((c) => c.college.id === s.collegeId) ? s : null
})()

export default function App() {
  const colleges = useKaal((s) => s.colleges)
  const session = useKaal((s) => s.session)
  const enterAs = useKaal((s) => s.enterAs)
  const switchCollege = useKaal((s) => s.switchCollege)
  const signOut = useKaal((s) => s.signOut)
  const resetDemo = useKaal((s) => s.resetDemo)
  const updateCollege = useKaal((s) => s.updateCollege)
  const active = switchableColleges(colleges)

  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash))
  useEffect(() => {
    const onHash = () => setRoute(parseRoute(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const go = (r: Route) => {
    const hash = formatRoute(r)
    if (window.location.hash !== hash) window.location.hash = hash
    setRoute(r)
    window.scrollTo({ top: 0 })
  }

  // a portal page is shown only with a session, and always the session's own portal; the URL follows
  const inPortal = route.page === 'portal' && session !== null
  useEffect(() => {
    if (route.page !== 'portal') return
    const own = session && route.portal === portalOf(session.role)
    const want = formatRoute(own ? route : session ? { page: 'portal', portal: portalOf(session.role) } : { page: 'landing' })
    if (window.location.hash !== want) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${want}`)
  }, [route, session])

  // Generated results per college (kept while navigating) and the timetable currently open.
  const [results, setResults] = useState<Record<string, SolveResult>>({})
  const [open, setOpen] = useState<string | null>(shared?.collegeId ?? null)
  // the shared view applies only to the first opening
  const [initial, setInitial] = useState(shared)
  // landing = public demo of any active college; inside a portal only what access.ts allows
  const openCollege = open ? (inPortal ? collegeFor(session, colleges, open) : active.find((c) => c.college.id === open)) : undefined
  const keep = (collegeId: string) => (r: SolveResult) => setResults((prev) => ({ ...prev, [collegeId]: r }))

  useEffect(() => {
    if (!shared) return
    const college = appStore.getState().colleges.find((c) => c.college.id === shared.collegeId)!
    // the solver is deterministic per seed, so one attempt at the shared seed rebuilds the same timetable
    runSolver(college, { attempts: 1, baseSeed: shared.seed }).then(keep(shared.collegeId))
  }, [])

  const view = (collegeId: string) => {
    setOpen(collegeId)
    window.scrollTo({ top: 0 })
  }
  const back = () => {
    setOpen(null)
    setInitial(null)
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.hash}`)
    if (!inPortal) requestAnimationFrame(() => document.getElementById('colleges')?.scrollIntoView())
  }
  const enter = (role: Role) => {
    enterAs(role)
    setOpen(null)
    go({ page: 'portal', portal: portalOf(role) })
  }
  const openAsAdmin = (collegeId: string) => {
    enterAs('collegeAdmin')
    switchCollege(collegeId)
    setOpen(null)
    go({ page: 'portal', portal: 'college' })
  }
  const exit = () => {
    signOut()
    setOpen(null)
    go({ page: 'landing' })
  }
  const reset = () => {
    if (!window.confirm('Reset to the two demo colleges? Every change saved in this browser will be lost.')) return
    resetDemo()
    setResults({})
    setOpen(null)
  }

  const home = session ? collegeFor(session, colleges, session.collegeId) : undefined
  // #/super/<collegeId>/structure[/<tab>] — only for a session allowed to shape that college
  const subPath = route.page === 'portal' ? (route.path ?? []) : []
  const target = inPortal && subPath[1] === 'structure' ? collegeFor(session, colleges, subPath[0]) : undefined
  const building = target && can(session, 'editStructure', target.college.id, colleges) ? target : undefined
  /** Apply a pure edit to one college; a timetable generated before it no longer matches, so it is dropped. */
  const editOf = (collegeId: string) => (fn: (c: CollegeData) => CollegeData) => {
    updateCollege(collegeId, fn)
    setResults((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => id !== collegeId)))
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 sm:px-8">
      <header className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-rule py-4">
        <button type="button" onClick={() => go({ page: 'landing' })} className="flex items-center gap-2.5" aria-label="Kaalchakra home">
          <Wheel size={28} spokes={8} />
          <span className="font-display text-xl font-semibold tracking-tight">Kaalchakra</span>
        </button>
        {session ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <RoleSwitcher role={session.role} onRole={enter} />
            {session.role !== 'superAdmin' && (
              <CollegeSwitcher
                colleges={active}
                collegeId={session.collegeId}
                onCollege={(id) => {
                  switchCollege(id)
                  setOpen(null)
                }}
              />
            )}
            {!inPortal && (
              <button
                type="button"
                onClick={() => go({ page: 'portal', portal: portalOf(session.role) })}
                className="rounded-full bg-ink px-3 py-1.5 text-[13px] font-medium text-paper transition hover:opacity-90"
              >
                My desk
              </button>
            )}
            <button
              type="button"
              onClick={exit}
              aria-label="Leave this desk"
              title="Leave this desk"
              className="rounded-full p-2 text-muted transition hover:bg-ink/5 hover:text-ink"
            >
              <LogOut size={16} aria-hidden />
            </button>
          </div>
        ) : (
          <span className="hidden font-mono text-[11px] tracking-[0.2em] text-muted uppercase sm:block">
            College timetables · any college
          </span>
        )}
      </header>

      <main className="flex-1">
        {openCollege && results[openCollege.college.id] ? (
          <TimetableView
            college={openCollege}
            result={results[openCollege.college.id]}
            onBack={back}
            onResult={keep(openCollege.college.id)}
            initial={initial?.collegeId === openCollege.college.id ? initial : undefined}
            readOnly={inPortal && !can(session, 'generate', openCollege.college.id, colleges)}
          />
        ) : openCollege ? (
          <div className="flex items-center gap-3 py-24 text-muted" role="status">
            <Wheel size={22} spokes={8} /> Opening the shared timetable…
          </div>
        ) : building ? (
          <StructureBuilder
            college={building}
            tab={asBuilderTab(subPath[2])}
            onTab={(t) => go({ page: 'portal', portal: 'super', path: [building.college.id, 'structure', t] })}
            onBack={() => go({ page: 'portal', portal: 'super' })}
            edit={editOf(building.college.id)}
          />
        ) : inPortal && session.role === 'superAdmin' ? (
          <SuperPortal
            colleges={colleges}
            results={results}
            onView={view}
            onOpenAsAdmin={openAsAdmin}
            onOpenStructure={(id) => go({ page: 'portal', portal: 'super', path: [id, 'structure'] })}
          />
        ) : inPortal && session.role === 'collegeAdmin' && home ? (
          <CollegePortal
            college={home}
            result={results[home.college.id]}
            onResult={keep(home.college.id)}
            onView={() => view(home.college.id)}
            page={subPath[0] === 'setup' ? 'setup' : 'overview'}
            setupTab={asSetupTab(subPath[1])}
            onPage={(page, tab) => go({ page: 'portal', portal: 'college', ...(page === 'setup' ? { path: ['setup', tab ?? asSetupTab(subPath[1])] } : {}) })}
            edit={can(session, 'editSetup', home.college.id, colleges) ? editOf(home.college.id) : undefined}
          />
        ) : inPortal && session.role === 'collegeAdmin' ? (
          <p className="py-16 text-muted">This college is archived or no longer exists — pick another college above.</p>
        ) : inPortal ? (
          <ComingSoon role={session.role} college={home} onRole={enter} />
        ) : (
          <Landing colleges={active} results={results} onResult={(id, r) => keep(id)(r)} onView={view} onEnter={enter} />
        )}
      </main>

      <footer className="no-print flex flex-wrap items-center justify-between gap-2 border-t border-rule py-5 font-mono text-[11px] text-muted">
        <span>Kaalchakra · v0.4 · saved in this browser</span>
        <span className="flex items-center gap-3">
          <button type="button" onClick={reset} className="underline-offset-2 hover:text-ink hover:underline">
            Reset demo data
          </button>
          <span>Built at the Punjab Jobs AI Bootcamp</span>
        </span>
      </footer>
    </div>
  )
}
