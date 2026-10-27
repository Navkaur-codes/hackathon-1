import { useEffect, useMemo, useState } from 'react'
import { AccountMenu, ChangePasswordDialog } from './components/AccountMenu'
import { LoginPage } from './components/LoginPage'
import { DEMO_PASSWORD } from './demoAccounts'
import type { AccountActions } from './components/AccountsPanel'
import { createSectionAccounts, createUser, resetPassword, setDisabled, type AuthOutcome } from './lib/auth'
import { SharedWeek } from './components/SharedWeek'
import { PublicTimetable } from './components/PublicTimetable'
import { decodePublic } from './lib/publicView'
import { ChatDrawer } from './components/ChatDrawer'
import { roleMeta } from './components/roles'
import { requestMeeting } from './lib/meetings'
import { localIso } from './lib/myDay'
import { decodeShare } from './lib/share'
import { Landing } from './components/Landing'
import { TimetableView } from './components/TimetableView'
import { Wheel } from './components/Wheel'
import { assistantScope, can, canDept, canLock, collegeFor, deptScope, guard, studentScope, switchableColleges, teacherScope } from './lib/access'
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
import { Insights } from './portals/college/Insights'
import { SuperPortal } from './portals/super/SuperPortal'
import { StructureBuilder } from './portals/super/structure/StructureBuilder'
import { asBuilderTab } from './portals/super/structure/tabs'
import { asSetupTab } from './portals/college/setup/tabs'
import { describeTimetable, type SolveResult } from './solver/best'
import { setDraft } from './lib/publish'
import { moveToRoom, syncAllocations } from './lib/allocation'
import { lockedFixed, toggleLock, unlockAll } from './lib/lock'
import { runSolver } from './solver/runSolver'
import { appStore, useKaal } from './store'
import type { CollegeData, Role, User } from './types'
import type { Jump, OpenPage } from './lib/assistant'

// A shared link (?college=…&seed=…) reopens that exact timetable, view and filters.
const shared = (() => {
  const s = typeof window === 'undefined' ? null : viewFromSearch(window.location.search)
  return s && switchableColleges(appStore.getState().colleges).some((c) => c.college.id === s.collegeId) ? s : null
})()

// A shared section week (?s=…) carries the timetable itself (lib/share.ts); null = a broken link.
const sharedWeekParam = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('s')
// A public department link (?p=…#/t/<college>/<dept>) carries its published snapshot (lib/publicView.ts).
const publicParam = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('p')

export default function App() {
  const colleges = useKaal((s) => s.colleges)
  const session = useKaal((s) => s.session)
  const users = useKaal((s) => s.users)
  const userId = useKaal((s) => s.userId)
  const signIn = useKaal((s) => s.signIn)
  const setUsers = useKaal((s) => s.setUsers)
  const me = users.find((u) => u.id === userId)
  const [changingPassword, setChangingPassword] = useState(false)
  const setStudentName = useKaal((s) => s.setStudentName)
  const signOut = useKaal((s) => s.signOut)
  const resetDemo = useKaal((s) => s.resetDemo)
  const updateCollege = useKaal((s) => s.updateCollege)
  const active = switchableColleges(colleges)

  const [sharedWeek, setSharedWeek] = useState(() => (sharedWeekParam === null ? undefined : decodeShare(sharedWeekParam)))
  const [publicSnap, setPublicSnap] = useState(() => (publicParam === null ? undefined : decodePublic(publicParam)))
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

  // v0.9: a session counts only with a signed-in account (a switcher session saved before accounts is signed out)
  useEffect(() => {
    if (session && !me) signOut()
  }, [session, me, signOut])
  // route protection (access.ts `guard`): portals need a signed-in account and are always its own; the URL follows
  const shown = guard(me ? session : null, route)
  useEffect(() => {
    const want = formatRoute(shown)
    if (route.page !== 'landing' && window.location.hash !== want) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${want}`)
  }, [shown, route.page])
  const inPortal = shown.page === 'portal' && session !== null

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
  // … and every locked class stays where it is (fixed bookings, rule H10)
  const designerOptions = (collegeId: string) => {
    const c = colleges.find((x) => x.college.id === collegeId)
    return can(session, 'generate', collegeId, colleges) && c ? { anyRoom: true, ...lockedFixed(c) } : undefined
  }
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
  /** "Sign in as …" on the landing page: the login page, pointing at that role's demo accounts. */
  const enter = (role: Role) => {
    setOpen(null)
    go(session && me ? { page: 'portal', portal: portalOf(session.role) } : { page: 'login', portal: portalOf(role) })
  }
  const doSignIn = async (username: string, password: string) => {
    const why = await signIn(username, password)
    if (!why) {
      const s = appStore.getState().session!
      setOpen(null)
      setInitial(null)
      go({ page: 'portal', portal: portalOf(s.role) })
    }
    return why
  }
  const exit = () => {
    signOut()
    setOpen(null)
    go({ page: 'landing' })
  }
  const reset = () => {
    if (!window.confirm('Reset to the two demo colleges? Every change saved in this browser will be lost.')) return
    resetDemo()
    void appStore.getState().ensureAccounts()
    setResults({})
    setOpen(null)
  }

  const home = session ? collegeFor(session, colleges, session.collegeId) : undefined
  // the department an HOD sits at (access.ts decides; undefined for every other role)
  const hodDept = deptScope(session, colleges)
  // the teacher a Teacher session is (access.ts decides)
  const self = teacherScope(session, colleges)
  const mySection = studentScope(session, colleges)
  // #/super/<collegeId>/structure[/<tab>] — only for a session allowed to shape that college
  const subPath = shown.page === 'portal' ? (shown.path ?? []) : []
  const target = inPortal && subPath[1] === 'structure' ? collegeFor(session, colleges, subPath[0]) : undefined
  const building = target && can(session, 'editStructure', target.college.id, colleges) ? target : undefined
  // #/super/<collegeId>/insights — the read-only dashboard
  const insightsTarget = inPortal && session.role === 'superAdmin' && subPath[1] === 'insights' ? collegeFor(session, colleges, subPath[0]) : undefined
  const superInsights = insightsTarget && can(session, 'insights', insightsTarget.college.id, colleges) ? insightsTarget : undefined
  /** Account changes (v0.9): applied to the accounts as they are now; `lib/auth.ts` checks who may do what. */
  const accountActions = (collegeId: string): AccountActions | undefined => {
    if (!session || !me) return undefined
    const by = session
    const apply = async (fn: (users: User[]) => Promise<AuthOutcome | { ok: true; users: User[] }> | AuthOutcome) => {
      const r = await fn(appStore.getState().users)
      if (r.ok) setUsers(r.users)
      return r.ok ? null : (r as { reason: string }).reason
    }
    const now = () => new Date().toISOString()
    return {
      create: (input) => apply((us) => createUser(us, appStore.getState().colleges, { ...input, mustChange: true }, by, now())),
      reset: (id, temp) => apply((us) => resetPassword(us, by, id, temp)),
      setDisabled: (id, off) => apply((us) => setDisabled(us, by, id, off)),
      ...(by.role === 'collegeAdmin' ? { createSections: (temp: string) => apply((us) => createSectionAccounts(us, appStore.getState().colleges, by, collegeId, temp, now())) } : {}),
    }
  }
  /** Apply a checked change (leave, bookings…) to the college as it is now — another tab may have changed it. */
  const applyTo =
    (collegeId: string) =>
    (fn: (c: CollegeData) => { ok: true; college: CollegeData } | { ok: false; reason: string }): string | null => {
      const current = appStore.getState().colleges.find((c) => c.college.id === collegeId)!
      const r = fn(current)
      if (r.ok) updateCollege(collegeId, () => r.college)
      return r.ok ? null : r.reason
    }
  /** Generate one department against the college as it is now (only that department moves; its locks stay). */
  const generateDeptOf = (collegeId: string) => async (deptId: string, round = 1) => {
    const current = appStore.getState().colleges.find((c) => c.college.id === collegeId)!
    const r = await runSolver(current, { attempts: 20, baseSeed: 1 + round * 20, ...deptSolveOptions(current, deptId) })
    updateCollege(collegeId, (c) => syncAllocations(mergeDept(c, deptId, r.timetable)))
  }
  /** Generate the whole college again; locked classes stay (College Admin, any room). */
  const generateAllOf = (collegeId: string) => async () => {
    const current = appStore.getState().colleges.find((c) => c.college.id === collegeId)!
    const r = await runSolver(current, { attempts: 20, baseSeed: 1 + Date.now() % 1000 * 20, anyRoom: true, ...lockedFixed(current) })
    updateCollege(collegeId, (c) => syncAllocations(setDraft(c, r.timetable)))
  }
  /** Apply a pure edit to one college; a timetable generated before it no longer matches, so it is dropped. */
  const editOf = (collegeId: string) => (fn: (c: CollegeData) => CollegeData) => {
    updateCollege(collegeId, fn)
    setResults((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => id !== collegeId)))
  }

  // Kaal Assistant: the college this desk is about (Super Admin: the one being looked at, else the last one)
  const askCollegeId =
    session?.role === 'superAdmin' ? (superInsights?.college.id ?? openCollege?.college.id ?? building?.college.id ?? session.collegeId ?? colleges[0]?.college.id) : session?.collegeId
  const askScope = inPortal && sharedWeek === undefined ? assistantScope(session, colleges, askCollegeId) : undefined
  const askCollege = askScope ? colleges.find((c) => c.college.id === askScope.collegeId) : undefined
  const askJump = (j: Jump) => {
    if (!askScope || !askCollege) return
    if (askScope.role === 'teacher') return go({ page: 'portal', portal: 'teacher', path: ['week'] })
    if (askScope.role === 'student') return go({ page: 'portal', portal: 'student', path: ['week'] })
    setInitial({ collegeId: askCollege.college.id, seed: askCollege.draft?.seed ?? 0, view: j.view, entityId: j.entityId, filters: {} })
    view(askCollege.college.id)
  }
  const askCanJump = (j: Jump) =>
    !askScope || !askCollege
      ? false
      : askScope.role === 'teacher'
        ? j.view === 'teacher' && j.entityId === askScope.teacherId
        : askScope.role === 'student'
          ? j.view === 'section' && j.entityId === askScope.sectionId
          : !!askCollege.draft
  const askOpen = (page: OpenPage) => {
    setOpen(null)
    if (page === 'meetings') go({ page: 'portal', portal: 'teacher', path: ['meetings'] })
    else if (page === 'leave') go({ page: 'portal', portal: session?.role === 'deptAdmin' ? 'dept' : 'college', path: ['leave'] })
    else go({ page: 'portal', portal: 'college', path: ['conflicts'] })
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 sm:px-8">
      <header className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-rule py-4">
        <button type="button" onClick={() => go({ page: 'landing' })} className="flex items-center gap-2.5" aria-label="Kaalchakra home">
          <Wheel size={28} spokes={8} />
          <span className="font-display text-xl font-semibold tracking-tight">Kaalchakra</span>
        </button>
        {session && me ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {!inPortal && (
              <button
                type="button"
                onClick={() => go({ page: 'portal', portal: portalOf(session.role) })}
                className="rounded-full bg-ink px-3 py-1.5 text-[13px] font-medium text-paper transition hover:opacity-90"
              >
                My desk
              </button>
            )}
            <AccountMenu user={me} college={home} onChangePassword={() => setChangingPassword(true)} onSignOut={exit} />
          </div>
        ) : shown.page === 'login' ? (
          <span className="hidden font-mono text-[11px] tracking-[0.2em] text-muted uppercase sm:block">College timetables · any college</span>
        ) : (
          <button
            type="button"
            onClick={() => go({ page: 'login' })}
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-1.5 text-[13px] font-medium text-paper transition hover:opacity-90"
          >
            Sign in
          </button>
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
        ) : shown.page === 'public' ? (
          <PublicTimetable
            colleges={colleges}
            snap={publicSnap}
            path={shown.path}
            onPath={(parts) => go({ page: 'public', path: parts })}
            onHome={() => {
              window.history.replaceState(null, '', window.location.pathname)
              setPublicSnap(undefined)
              go({ page: 'landing' })
            }}
          />
        ) : shown.page === 'login' ? (
          <LoginPage users={users} colleges={colleges} hint={shown.portal} demoPassword={DEMO_PASSWORD} onSignIn={doSignIn} />
        ) : openCollege && openResult ? (
          <TimetableView
            key={`${openCollege.college.id}:${initial?.collegeId === openCollege.college.id ? `${initial.view}:${initial.entityId}` : ''}`}
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
            canLock={inPortal ? (p) => canLock(session, p.deptId, colleges) : undefined}
            onToggleLock={inPortal ? (p) => applyTo(openCollege.college.id)((c) => (canLock(session, p.deptId, colleges) ? toggleLock(c, p) : { ok: false, reason: 'Not yours to lock.' })) : undefined}
            onUnlockAll={inPortal && can(session, 'generate', openCollege.college.id, colleges) ? () => updateCollege(openCollege.college.id, unlockAll) : undefined}
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
        ) : superInsights ? (
          <section className="py-8">
            <button type="button" onClick={() => go({ page: 'portal', portal: 'super' })} className="text-[13px] text-muted underline-offset-2 hover:text-ink hover:underline">
              ← All colleges
            </button>
            <h1 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">{superInsights.college.name}</h1>
            <p className="mb-6 text-[14px] text-muted">Insights · read-only for the Super Admin</p>
            <Insights college={superInsights} onExchangeHint={false} />
          </section>
        ) : inPortal && session.role === 'superAdmin' ? (
          <SuperPortal
            colleges={colleges}
            onView={view}
            onInsights={(id) => go({ page: 'portal', portal: 'super', path: [id, 'insights'] })}
            users={users}
            accountActions={accountActions}
            onOpenStructure={(id) => go({ page: 'portal', portal: 'super', path: [id, 'structure'] })}
          />
        ) : inPortal && session.role === 'collegeAdmin' && home ? (
          <CollegePortal
            key={home.college.id}
            college={home}
            onResult={saveDraft(home.college.id)}
            onView={() => view(home.college.id)}
            page={subPath[0] === 'setup' ? 'setup' : subPath[0] === 'leave' || subPath[0] === 'conflicts' || subPath[0] === 'insights' ? subPath[0] : 'overview'}
            setupTab={asSetupTab(subPath[1])}
            onPage={(page, tab) =>
              go({
                page: 'portal',
                portal: 'college',
                ...(page === 'setup' ? { path: ['setup', tab ?? asSetupTab(subPath[1])] } : page === 'leave' || page === 'conflicts' || page === 'insights' ? { path: [page] } : {}),
              })
            }
            actLeave={can(session, 'leave', home.college.id, colleges) ? applyTo(home.college.id) : undefined}
            people={can(session, 'editSetup', home.college.id, colleges) ? { users, actions: accountActions(home.college.id)! } : undefined}
            fixes={
              can(session, 'conflicts', home.college.id, colleges)
                ? {
                    generateDept: (deptId) => generateDeptOf(home.college.id)(deptId),
                    generateAll: generateAllOf(home.college.id),
                    moveRoom: (p, roomId) => applyTo(home.college.id)((c) => moveToRoom(c, p, roomId)),
                    unlock: (p) => applyTo(home.college.id)((c) => (p.locked ? toggleLock(c, p) : { ok: true, college: c })),
                  }
                : undefined
            }
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
            page={subPath[0] === 'setup' ? 'setup' : subPath[0] === 'exchange' ? 'exchange' : subPath[0] === 'leave' ? 'leave' : 'overview'}
            actLeave={canDept(session, 'leave', hodDept, colleges) ? applyTo(home.college.id) : undefined}
            setupTab={asSetupTab(subPath[1], true)}
            onPage={(page, tab) =>
              go({
                page: 'portal',
                portal: 'dept',
                ...(page === 'setup'
                  ? { path: ['setup', tab ?? asSetupTab(subPath[1], true)] }
                  : page === 'exchange' || page === 'leave'
                    ? { path: [page] }
                    : {}),
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
                ? (round) => generateDeptOf(home.college.id)(hodDept, round)
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
            act={(fn) => {
              // apply to the college as it is now (another tab may have changed it)
              const current = appStore.getState().colleges.find((c) => c.college.id === home.college.id)!
              const r = fn(current)
              if (r.ok) updateCollege(home.college.id, () => r.college)
              return r.ok ? null : r.reason
            }}
          />
        ) : inPortal && session.role === 'student' ? (
          <p className="py-16 text-muted">This college has no sections yet, or it is archived — pick another college above.</p>
        ) : inPortal && session.role === 'teacher' ? (
          <p className="py-16 text-muted">This college has no teachers yet, or it is archived — pick another college above.</p>
        ) : inPortal ? (
          <ComingSoon role={session.role} college={home} onRole={enter} />
        ) : (
          <Landing colleges={active} results={results} onResult={(id, r) => keep(id)(r)} onView={view} onEnter={enter} onPublic={(parts) => go({ page: 'public', path: parts })} />
        )}
      </main>

      {me && (changingPassword || me.mustChange) && (
        <ChangePasswordDialog user={me} users={users} forced={!!me.mustChange} onSaved={setUsers} onClose={() => setChangingPassword(false)} onSignOut={exit} />
      )}

      {askScope && askCollege && session && (
        <ChatDrawer
          key={`${askCollege.college.id}/${session.role}/${session.teacherId ?? ''}/${session.sectionId ?? ''}/${session.deptId ?? ''}`}
          college={askCollege}
          scope={askScope}
          accent={roleMeta(session.role).accent}
          onJump={askJump}
          canJump={askCanJump}
          onOpen={askScope.role === 'student' || askScope.role === 'super' ? undefined : askOpen}
          onRequest={
            askScope.role === 'student'
              ? (a, topic) => {
                  if (!session.studentName?.trim()) return 'Type your name in “Your name” at the top of your desk first — the teacher needs to know who is asking.'
                  const d = new Date()
                  return applyTo(askCollege.college.id)((c) =>
                    requestMeeting(
                      c,
                      { studentName: session.studentName ?? '', sectionId: a.sectionId, teacherId: a.teacherId, date: a.date, period: a.period, topic, note: 'Asked from Kaal Assistant' },
                      d.toISOString(),
                      { today: localIso(d), minutes: d.getHours() * 60 + d.getMinutes() },
                    ),
                  )
                }
              : undefined
          }
        />
      )}

      <footer className="no-print flex flex-wrap items-center justify-between gap-2 border-t border-rule py-5 font-mono text-[11px] text-muted">
        <span>Kaalchakra · v0.8 · saved in this browser</span>
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
