import type { CollegeData } from '../../../types'

export const SETUP_TABS = [
  { id: 'teachers', label: 'Teachers' },
  { id: 'assignments', label: 'Who teaches what' },
  { id: 'rooms', label: 'Rooms' },
  { id: 'sections', label: 'Sections' },
  { id: 'blocked', label: 'Blocked slots' },
  { id: 'paste', label: 'Paste from Excel' },
] as const

export type SetupTab = (typeof SETUP_TABS)[number]['id']

export const asSetupTab = (s: string | undefined): SetupTab => SETUP_TABS.find((t) => t.id === s)?.id ?? 'teachers'

/** Apply a pure edit (lib/edit.ts) to this college. */
export type Edit = (fn: (c: CollegeData) => CollegeData) => void
