import { useEffect, useMemo, useState } from 'react'
import { LogOut } from 'lucide-react'
import { CollegeSwitcher } from './components/CollegeSwitcher'
import { DeptSwitcher } from './components/DeptSwitcher'
import { TeacherSwitcher } from './components/TeacherSwitcher'
import { SectionSwitcher } from './components/SectionSwitcher'
import { SharedWeek } from './components/SharedWeek'
import { decodeShare } from './lib/share'
import { Landing } from './components/Landing'
import { RoleSwitcher } from './components/RoleSwitcher'
import { TimetableView } from './components/TimetableView'
import { Wheel } from './components/Wheel'
import { can, canDept, collegeFor, deptScope, studentScope, switchableColleges, teacherScope } from './lib/access'
import { deptEdit, deptSolveOptions, markReady, mergeDept, setDeptStatus } from './lib/deptPlan'
import { formatRoute, parseRoute, portalOf, type Route } from './lib/route'
import { viewFromSearch } from './lib/viewUrl'
import { ComingSoon } from './portals/ComingSoon'
import { DeptPortal } from './portals/department/DeptPortal'
import { TeacherPortal } from './portals/teacher/TeacherPortal'
import { asTeacherPage } from './portals/teacher/pages'
import { StudentPortal } from './portals/student/StudentPortal'
import { asStudentPage } from './portals/student/pages'
import { CollegePortal } from './portals/college/CollegePortal'
import { SuperPortal } from './portals/super/SuperPortal'
import { StructureBuilder } from './portals/super/structure/StructureBuilder'
import { asBuilderTab } from './portals/super/structure/tabs'
import { asSetupTab } from './portals/college/setup/tabs'
import { describeTimetable, type SolveResult } from './solver/best'
import { setDraft } from './lib/publish'
import { moveToRoom, syncAllocations } from './lib/allocation'
import { runSolver } from './solver/runSolver'
import { appStore, useKaal } from './store'
import type { CollegeData, Role } from './types'

// A shared link (?college=…&seed=…) reopens that exact timetable, view and filters.
const shared = (() => {
  const s = typeof window === 'undefined' ? null : viewFromSearch(window.location.search)
  return s && switchableColleges(appStore.getState().colleges).some((c) => c.college.id === s.collegeId) ? s : null
})()

// A shared section week (?s=…) carries the timetable itself (lib/share.ts); null = a broken link.
const sharedWeekParam = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('s')

export default function App() {
  const colleges = useKaal((s) => s.colleges)
  const session = useKaal((s) => s.session)
  const enterAs = useKaal((s) => s.enterAs)
  const switchCollege = useKaal((s) => s.switchCollege)
  const switchDept = useKaal((s) => s.switchDept)
  const switchTeacher = useKaal((s) => s.switchTeacher)
  const switchSection = useKaal((s) => s.switchSection)
  const setStudentName = useKaal((s) => s.setStudentName)
  const signOut = useKaal((s) => s.signOut)
  const resetDemo = useKaal((s) => s.resetDemo)
  const updateCollege = useKaal((s) => s.updateCollege)
  const active = switchableColleges(colleges)

  const [sharedWeek, setSharedWeek] = useState(() => (sharedWeekParam === null ? undefined : decodeShare(sharedWeekParam)))
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash))
  useEffect(() => {
    const onHash = () => setRoute(parseRoute(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const go = (r: Route) => {
    // any navigation leaves a shared week (?s=…)
    if (sharedWeek !== undefined) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.hash}`)
      setSharedWeek(undefined)
    }
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

  // Public landing previews per college (in memory only — the desks store a real draft instead).
  const [results, setResults] = useState<Record<string, SolveResult>>({})
  const [open, setOpen] = useState<string | null>(shared?.collegeId ?? null)
  // the shared view applies only to the first opening
  const [initial, setInitial] = useState(shared)
  // landing = public demo of any active college; inside a portal only what access.ts allows
  const openCollege = open ? (inPortal ? collegeFor(session, colleges, open) : active.find((c) => c.college.id === open)) : undefined
  const keep = (collegeId: string) => (r: SolveResult) => setResults((prev) => ({ ...prev, [collegeId]: r }))
  /** Inside a desk a generated timetable is saved as the college's draft. */
  // every use of another department's room is recorded as a semester allocation (H11)
  const saveDraft = (collegeId: string) => (r: SolveResult) => updateCollege(collegeId, (c) => syncAllocations(setDraft(c, r.timetable)))
  /** The College Admin designs the timetable: any suitable room of the college may be used. */
  const designerOptions = (collegeId: string) => (can(session, 'generate', collegeId, colleges) ? { anyRoom: true } : undefined)
  // a stored draft is described against the college as it is now (score, clashes, pre-flight recomputed)
  const openStored = useMemo(
    () => (inPortal && openCollege?.draft ? describeTimetable(openCollege, openCollege.draft) : undefined),
    [inPortal, openCollege],
  )
  const openResult = inPortal ? openStored : openCollege && results[openCollege.college.id]

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
  // the department an HOD sits at (access.ts decides; undefined for every other role)
  const hodDept = deptScope(session, colleges)
  // the teacher a Teacher session is (access.ts decides)
  const self = teacherScope(session, colleges)
  const mySection = studentScope(session, colleges)
  // a saved session from before, or one whose teacher / section was removed, sits at the first one of its college
  const roleKind = session?.role
  useEffect(() => {
    if (!home) return
    if (roleKind === 'teacher' && !self && home.teachers[0]) switchTeacher(home.teachers[0].id)
    if (roleKind === 'student' && !mySection && home.sections[0]) switchSection(home.sections[0].id)
  }, [home, roleKind, self, mySection, switchTeacher, switchSection])
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
            {hodDept && home && (
              <DeptSwitcher
                college={home}
                deptId={hodDept}
                onDept={(id) => {
                  switchDept(id)
                  setOpen(null)
                }}
              />
            )}
            {session.role === 'teacher' && home && home.teachers.length > 0 && (
              <TeacherSwitcher college={home} teacherId={self} onTeacher={switchTeacher} />
            )}
            {session.role === 'student' && home && home.sections.length > 0 && (
              <SectionSwitcher college={home} sectionId={mySection} onSection={switchSection} />
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
        {sharedWeek !== undefined ? (
          <SharedWeek
            snap={sharedWeek}
            onLeave={() => {
              window.history.replaceState(null, '', window.location.pathname)
              setSharedWeek(undefined)
            }}
          />
        ) : openCollege && openResult ? (
          <TimetableView
            college={openCollege}
            result={openResult}
            onBack={back}
            onResult={inPortal ? saveDraft(openCollege.college.id) : keep(openCollege.college.id)}
            solveOptions={inPortal ? designerOptions(openCollege.college.id) : undefined}
            onMoveRoom={
              inPortal && can(session, 'generate', openCollege.college.id, colleges)
                ? (placement, roomId) => {
                    const current = appStore.getState().colleges.find((c) => c.college.id === openCollege.college.id)!
                    const r = moveToRoom(current, placement, roomId)
                    if (r.ok) updateCollege(openCollege.college.id, () => r.college)
                    return r.ok ? null : r.reason
                  }
                : undefined
            }
            notice={
              inPortal && openCollege.draftStale
                ? 'This draft is out of date — the structure or setup changed after it was generated. Generate again before publishing.'
                : undefined
            }
            initial={initial?.collegeId === openCollege.college.id ? initial : undefined}
            readOnly={inPortal && !can(session, 'generate', openCollege.college.id, colleges)}
            scopeDeptId={inPortal ? hodDept : undefined}
          />
        ) : openCollege && !inPortal ? (
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
            onView={view}
            onOpenAsAdmin={openAsAdmin}
            onOpenStructure={(id) => go({ page: 'portal', portal: 'super', path: [id, 'structure'] })}
          />
        ) : inPortal && session.role === 'collegeAdmin' && home ? (
          <CollegePortal
            key={home.college.id}
            college={home}
            onResult={saveDraft(home.college.id)}
            onView={() => view(home.college.id)}
            page={subPath[0] === 'setup' ? 'setup' : 'overview'}
            setupTab={asSetupTab(subPath[1])}
            onPage={(page, tab) => go({ page: 'portal', portal: 'college', ...(page === 'setup' ? { path: ['setup', tab ?? asSetupTab(subPath[1])] } : {}) })}
            edit={can(session, 'editSetup', home.college.id, colleges) ? editOf(home.college.id) : undefined}
            canPublish={can(session, 'publish', home.college.id, colleges)}
            canExport={can(session, 'export', home.college.id, colleges)}
            solveOptions={designerOptions(home.college.id)}
            actBookings={
              can(session, 'roomBookings', home.college.id, colleges)
                ? (fn) => {
                    const current = appStore.getState().colleges.find((c) => c.college.id === home.college.id)!
                    const r = fn(current)
                    if (r.ok) updateCollege(home.college.id, () => r.college)
                    return r.ok ? null : r.reason
                  }
                : undefined
            }
          />
        ) : inPortal && session.role === 'collegeAdmin' ? (
          <p className="py-16 text-muted">This college is archived or no longer exists — pick another college above.</p>
        ) : inPortal && session.role === 'deptAdmin' && home && hodDept ? (
          <DeptPortal
            key={`${home.college.id}/${hodDept}`}
            college={home}
            deptId={hodDept}
            page={subPath[0] === 'setup' ? 'setup' : subPath[0] === 'exchange' ? 'exchange' : 'overview'}
            setupTab={asSetupTab(subPath[1], true)}
            onPage={(page, tab) =>
              go({
                page: 'portal',
                portal: 'dept',
                ...(page === 'setup' ? { path: ['setup', tab ?? asSetupTab(subPath[1], true)] } : page === 'exchange' ? { path: ['exchange'] } : {}),
              })
            }
            edit={canDept(session, 'editDept', hodDept, colleges) ? (fn) => editOf(home.college.id)(deptEdit(hodDept, fn)) : undefined}
            onReady={
              canDept(session, 'markReady', hodDept, colleges)
                ? (ready) => updateCollege(home.college.id, (c) => (ready ? markReady(c, hodDept) : setDeptStatus(c, hodDept, 'draft')))
                : undefined
            }
            onView={can(session, 'viewDraft', home.college.id, colleges) ? () => view(home.college.id) : undefined}
            onGenerate={
              canDept(session, 'generateDept', hodDept, colleges)
                ? async (round) => {
                    // solve against the college as it is now; only this department moves
                    const current = appStore.getState().colleges.find((c) => c.college.id === home.college.id)!
                    const r = await runSolver(current, { attempts: 20, baseSeed: 1 + round * 20, ...deptSolveOptions(current, hodDept) })
                    updateCollege(home.college.id, (c) => syncAllocations(mergeDept(c, hodDept, r.timetable)))
                  }
                : undefined
            }
            act={
              canDept(session, 'exchange', hodDept, colleges)
                ? (fn) => {
                    // decide against the college as it is now (another tab may have changed it)
                    const current = appStore.getState().colleges.find((c) => c.college.id === home.college.id)!
                    const r = fn(current)
                    if (r.ok) updateCollege(home.college.id, () => r.college)
                    return r.ok ? null : r.reason
                  }
                : undefined
            }
          />
        ) : inPortal && session.role === 'deptAdmin' ? (
          <p className="py-16 text-muted">This college has no departments yet, or it is archived — pick another college above.</p>
        ) : inPortal && session.role === 'teacher' && home && self ? (
          <TeacherPortal
            key={`${home.college.id}/${self}`}
            college={home}
            teacherId={self}
            page={asTeacherPage(subPath[0])}
            onPage={(p) => go({ page: 'portal', portal: 'teacher', ...(p === 'today' ? {} : { path: [p] }) })}
            act={(fn) => {
              // apply to the college as it is now (another tab may have changed it)
              const current = appStore.getState().colleges.find((c) => c.college.id === home.college.id)!
              const r = fn(current)
              if (r.ok) updateCollege(home.college.id, () => r.college)
              return r.ok ? null : r.reason
            }}
          />
        ) : inPortal && session.role === 'student' && home && mySection ? (
          <StudentPortal
            key={`${home.college.id}/${mySection}`}
            college={home}
            sectionId={mySection}
            studentName={session.studentName ?? ''}
            onName={setStudentName}
            page={asStudentPage(subPath[0])}
            onPage={(p) => go({ page: 'portal', portal: 'student', ...(p === 'today' ? {} : { path: [p] }) })}
          />
        ) : inPortal && session.role === 'student' ? (
          <p className="py-16 text-muted">This college has no sections yet, or it is archived — pick another college above.</p>
        ) : inPortal && session.role === 'teacher' ? (
          <p className="py-16 text-muted">This college has no teachers yet, or it is archived — pick another college above.</p>
        ) : inPortal ? (
          <ComingSoon role={session.role} college={home} onRole={enter} />
        ) : (
          <Landing colleges={active} results={results} onResult={(id, r) => keep(id)(r)} onView={view} onEnter={enter} />
        )}
      </main>

      <footer className="no-print flex flex-wrap items-center justify-between gap-2 border-t border-rule py-5 font-mono text-[11px] text-muted">
        <span>Kaalchakra · v0.6 · saved in this browser</span>
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
