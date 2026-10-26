export type StudentPage = 'today' | 'week' | 'meet' | 'share'

const PAGES: StudentPage[] = ['today', 'week', 'meet', 'share']

/** `#/student/<page>` → a known page, else Now & today. */
export const asStudentPage = (s: string | undefined): StudentPage => (PAGES.includes(s as StudentPage) ? (s as StudentPage) : 'today')
