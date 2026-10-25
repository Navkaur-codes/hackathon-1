// The platform's memory: every college and the current session, persisted in localStorage.
// Actions stay thin — they find one college by id (rule G1) and hand it to pure functions.
// The demo colleges are only a seed built through the same `buildCollege` path as user data (rule G3).

import { useStore } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { createStore } from 'zustand/vanilla'
import { buildDemoColleges } from './demoData'
import { sessionFor } from './lib/access'
import type { CollegeData, Id, Role, Session } from './types'

export type KaalState = {
  colleges: CollegeData[]
  session: Session | null
  /** Switch role (stand-in for logging in until v0.9). */
  enterAs: (role: Role) => void
  switchCollege: (collegeId: Id) => void
  signOut: () => void
  /** Replace one college with `fn(college)`; other colleges are never touched. */
  updateCollege: (collegeId: Id, fn: (c: CollegeData) => CollegeData) => void
  /** Back to the two demo colleges; the session is kept only if it still fits. */
  resetDemo: () => void
}

type Persisted = Pick<KaalState, 'colleges' | 'session'>

export const STORE_KEY = 'kaalchakra'
export const STORE_VERSION = 1

const seed = (): Persisted => ({ colleges: buildDemoColleges(), session: null })

/** Store factory; tests pass an in-memory storage, the app uses localStorage. */
export function createKaalStore(storage?: StateStorage) {
  return createStore<KaalState>()(
    persist(
      (set) => ({
        ...seed(),
        enterAs: (role) => set((s) => ({ session: sessionFor(role, s.colleges, s.session) })),
        switchCollege: (collegeId) =>
          set((s) => (s.session && s.colleges.some((c) => c.college.id === collegeId) ? { session: { role: s.session.role, collegeId } } : s)),
        signOut: () => set({ session: null }),
        updateCollege: (collegeId, fn) =>
          set((s) => ({ colleges: s.colleges.map((c) => (c.college.id === collegeId ? fn(c) : c)) })),
        resetDemo: () =>
          set((s) => {
            const fresh = seed()
            return { colleges: fresh.colleges, session: s.session && sessionFor(s.session.role, fresh.colleges, s.session) }
          }),
      }),
      {
        name: STORE_KEY,
        version: STORE_VERSION,
        storage: createJSONStorage(() => storage ?? localStorage),
        partialize: (s): Persisted => ({ colleges: s.colleges, session: s.session }),
        // older or unknown saved shapes are replaced by a fresh seed rather than half-loaded
        migrate: (persisted, version) => (version === STORE_VERSION ? (persisted as Persisted) : seed()),
        merge: (persisted, current) => {
          const p = persisted as Partial<Persisted> | undefined
          if (!p || !Array.isArray(p.colleges) || p.colleges.length === 0) return current
          return { ...current, colleges: p.colleges, session: p.session ?? null }
        },
      },
    ),
  )
}

export const appStore = createKaalStore()

/** React hook over the app store. */
export const useKaal = <T,>(selector: (s: KaalState) => T): T => useStore(appStore, selector)
