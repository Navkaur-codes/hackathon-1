export type TeacherPage = 'today' | 'week' | 'meetings' | 'leave' | 'hours'

const PAGES: TeacherPage[] = ['today', 'week', 'meetings', 'leave', 'hours']

/** `#/teacher/<page>` → a known page, else Today. */
export const asTeacherPage = (s: string | undefined): TeacherPage => (PAGES.includes(s as TeacherPage) ? (s as TeacherPage) : 'today')
