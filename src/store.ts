// The platform's memory: every college and the current session, persisted in localStorage.
// Actions stay thin — they find one college by id (rule G1) and hand it to pure functions.
// The demo colleges are only a seed built through the same `buildCollege` path as user data (rule G3).

import { useStore } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { createStore } from 'zustand/vanilla'
import { buildDemoColleges } from './demoData'
import { buildDemoAccounts } from './demoAccounts'
import { sessionFor } from './lib/access'
import { LOGIN_ERROR, sessionOf, verifyLogin } from './lib/auth'
import type { CollegeData, Id, Role, Session, User } from './types'

export type KaalState = {
  colleges: CollegeData[]
  session: Session | null
  /** Sign-in accounts (v0.9) — salted hashes only, never a plain password. */
  users: User[]
  /** Id of the signed-in account (null with a switcher session in tests, or signed out). */
  userId: Id | null
  /** Check the credentials and open that account's session; returns the refusal, or null when signed in. */
  signIn: (username: string, password: string) => Promise<string | null>
  /** Replace the accounts (after a pure change from lib/auth.ts). */
  setUsers: (users: User[]) => void
  /** Seed the demo accounts for the colleges in the store when there are none (first load, after a migrate or a reset). */
  ensureAccounts: () => Promise<void>
  /** Switch role (stand-in for logging in until v0.9). */
  enterAs: (role: Role) => void
  switchCollege: (collegeId: Id) => void
  /** An HOD changes department (within their college). */
  switchDept: (deptId: Id) => void
  /** A Teacher session picks which teacher it is (within its college). */
  switchTeacher: (teacherId: Id) => void
  /** A Student session picks its section (within its college) and types its name. */
  switchSection: (sectionId: Id) => void
  setStudentName: (name: string) => void
  signOut: () => void
  /** Add a college built by `lib/edit.ts` (new from template or clone); ignored if its id is taken. */
  addCollege: (c: CollegeData) => void
  /** Replace one college with `fn(college)`; other colleges are never touched. */
  updateCollege: (collegeId: Id, fn: (c: CollegeData) => CollegeData) => void
  /** Back to the two demo colleges; the session is kept only if it still fits. */
  resetDemo: () => void
}

type Persisted = Pick<KaalState, 'colleges' | 'session' | 'users' | 'userId'>

export const STORE_KEY = 'kaalchakra'
export const STORE_VERSION = 2

const seed = (): Persisted => ({ colleges: buildDemoColleges(), session: null, users: [], userId: null })

/** Store factory; tests pass an in-memory storage, the app uses localStorage. */
export function createKaalStore(storage?: StateStorage) {
  return createStore<KaalState>()(
    persist(
      (set, get) => ({
        ...seed(),
        enterAs: (role) => set((s) => ({ session: sessionFor(role, s.colleges, s.session) })),
        switchCollege: (collegeId) =>
          set((s) =>
            s.session && s.colleges.some((c) => c.college.id === collegeId)
              ? { session: sessionFor(s.session.role, s.colleges, { role: s.session.role, collegeId }) }
              : s,
          ),
        switchDept: (deptId) =>
          set((s) =>
            s.session?.role === 'deptAdmin' && s.colleges.find((c) => c.college.id === s.session!.collegeId)?.departments.some((d) => d.id === deptId)
              ? { session: { ...s.session, deptId } }
              : s,
          ),
        switchTeacher: (teacherId) =>
          set((s) =>
            s.session?.role === 'teacher' && s.colleges.find((c) => c.college.id === s.session!.collegeId)?.teachers.some((t) => t.id === teacherId)
              ? { session: { ...s.session, teacherId } }
              : s,
          ),
        switchSection: (sectionId) =>
          set((s) =>
            s.session?.role === 'student' && s.colleges.find((c) => c.college.id === s.session!.collegeId)?.sections.some((x) => x.id === sectionId)
              ? { session: { ...s.session, sectionId } }
              : s,
          ),
        setStudentName: (name) => set((s) => (s.session?.role === 'student' ? { session: { ...s.session, studentName: name.slice(0, 60) } } : s)),
        signOut: () => set({ session: null, userId: null }),
        signIn: async (username, password) => {
          const s = get()
          const r = await verifyLogin(s.users, username, password)
          if (!r.ok) return r.reason
          const session = sessionOf(r.user, get().colleges)
          if (!session) return LOGIN_ERROR
          set({ session, userId: r.user.id })
          return null
        },
        setUsers: (users) => set({ users }),
        ensureAccounts: async () => {
          if (get().users.length > 0) return
          const users = await buildDemoAccounts(get().colleges, new Date().toISOString())
          // another call may have seeded meanwhile
          if (get().users.length === 0) set({ users })
        },
        addCollege: (c) =>
          set((s) => (s.colleges.some((x) => x.college.id === c.college.id) ? s : { colleges: [...s.colleges, c] })),
        updateCollege: (collegeId, fn) =>
          set((s) => ({ colleges: s.colleges.map((c) => (c.college.id === collegeId ? fn(c) : c)) })),
        resetDemo: () =>
          set((s) => {
            const fresh = seed()
            // accounts are re-seeded for the fresh colleges (ensureAccounts); the signed-in account keeps its session only if it still fits
            return { colleges: fresh.colleges, users: [], session: s.session && sessionFor(s.session.role, fresh.colleges, s.session) }
          }),
      }),
      {
        name: STORE_KEY,
        version: STORE_VERSION,
        storage: createJSONStorage(() => storage ?? localStorage),
        partialize: (s): Persisted => ({ colleges: s.colleges, session: s.session, users: s.users, userId: s.userId }),
        // version 1 (before accounts) keeps its colleges and session and gets accounts seeded on load;
        // older or unknown saved shapes are replaced by a fresh seed rather than half-loaded
        migrate: (persisted, version) =>
          version === STORE_VERSION
            ? (persisted as Persisted)
            : version === 1
              ? { ...(persisted as Persisted), users: [], userId: null }
              : seed(),
        merge: (persisted, current) => {
          const p = persisted as Partial<Persisted> | undefined
          if (!p || !Array.isArray(p.colleges) || p.colleges.length === 0) return current
          return { ...current, colleges: p.colleges, session: p.session ?? null, users: Array.isArray(p.users) ? p.users : [], userId: p.userId ?? null }
        },
      },
    ),
  )
}

/**
 * Keep every open tab on the same data: when another tab saves, reload from storage. Without this, a tab
 * opened earlier still holds the old colleges in memory and its next save would overwrite newer edits.
 */
export function syncAcrossTabs(store: ReturnType<typeof createKaalStore>, target: EventTarget) {
  const onStorage = (e: Event) => {
    const key = (e as StorageEvent).key
    if (key === STORE_KEY || key === null) void store.persist.rehydrate()
  }
  target.addEventListener('storage', onStorage)
  return () => target.removeEventListener('storage', onStorage)
}

export const appStore = createKaalStore()
if (typeof window !== 'undefined') {
  syncAcrossTabs(appStore, window)
  void appStore.getState().ensureAccounts()
}

/** React hook over the app store. */
export const useKaal = <T,>(selector: (s: KaalState) => T): T => useStore(appStore, selector)
