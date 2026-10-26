import type { CollegeData } from '../../../types'

/** `only`: a tab shown just on the College Admin desk (`college`) or just on an HOD desk (`dept`). */
export const SETUP_TABS = [
  { id: 'teachers', label: 'Teachers' },
  { id: 'assignments', label: 'Who teaches what' },
  { id: 'subjects', label: 'Subjects', only: 'dept' },
  { id: 'rooms', label: 'Rooms' },
  { id: 'sections', label: 'Sections' },
  { id: 'blocked', label: 'Blocked slots', only: 'college' },
  { id: 'paste', label: 'Paste from Excel' },
] as const

export type SetupTab = (typeof SETUP_TABS)[number]['id']

/** Tabs for the College Admin (whole college) or an HOD (one department). */
export const setupTabsFor = (forDept: boolean) =>
  SETUP_TABS.filter((t) => !('only' in t) || t.only === (forDept ? 'dept' : 'college'))

export const asSetupTab = (s: string | undefined, forDept = false): SetupTab =>
  setupTabsFor(forDept).find((t) => t.id === s)?.id ?? 'teachers'

/** Apply a pure edit (lib/edit.ts) to this college. */
export type Edit = (fn: (c: CollegeData) => CollegeData) => void
