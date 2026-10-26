export type StudentPage = 'today' | 'week' | 'share'

const PAGES: StudentPage[] = ['today', 'week', 'share']

/** `#/student/<page>` → a known page, else Now & today. */
export const asStudentPage = (s: string | undefined): StudentPage => (PAGES.includes(s as StudentPage) ? (s as StudentPage) : 'today')
