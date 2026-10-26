export type TeacherPage = 'today' | 'week' | 'leave' | 'hours'

const PAGES: TeacherPage[] = ['today', 'week', 'leave', 'hours']

/** `#/teacher/<page>` → a known page, else Today. */
export const asTeacherPage = (s: string | undefined): TeacherPage => (PAGES.includes(s as TeacherPage) ? (s as TeacherPage) : 'today')
