// Timetable filters (pure) and their URL form, so a filtered view can be bookmarked or shared.

import type { Id, RoomType } from '../types'
import type { GridCell } from './gridModel'

export type Filters = {
  deptId?: Id
  subjectCode?: string
  kind?: 'theory' | 'lab'
  roomType?: RoomType
  day?: number
}

export const isActive = (f: Filters) => Object.values(f).some((v) => v !== undefined && v !== '')

export function matches(cell: GridCell, f: Filters): boolean {
  if (f.deptId && cell.section.deptId !== f.deptId) return false
  if (f.subjectCode && cell.subject.code !== f.subjectCode) return false
  if (f.kind && (f.kind === 'lab') !== cell.lab) return false
  if (f.roomType && cell.room?.type !== f.roomType) return false
  if (f.day !== undefined && cell.day !== f.day) return false
  return true
}

const ROOM_TYPES: RoomType[] = ['lecture', 'lab', 'seminar']

/** Filters → `dept=…&subject=…&kind=…&room=…&day=…` (empty values left out). */
export function toSearch(f: Filters): string {
  const q = new URLSearchParams()
  if (f.deptId) q.set('dept', f.deptId)
  if (f.subjectCode) q.set('subject', f.subjectCode)
  if (f.kind) q.set('kind', f.kind)
  if (f.roomType) q.set('room', f.roomType)
  if (f.day !== undefined) q.set('day', String(f.day))
  return q.toString()
}

/** Inverse of `toSearch`; ignores anything malformed. */
export function fromSearch(search: string): Filters {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const f: Filters = {}
  const dept = q.get('dept')
  if (dept) f.deptId = dept
  const subject = q.get('subject')
  if (subject) f.subjectCode = subject
  const kind = q.get('kind')
  if (kind === 'theory' || kind === 'lab') f.kind = kind
  const room = q.get('room') as RoomType | null
  if (room && ROOM_TYPES.includes(room)) f.roomType = room
  const day = q.get('day')
  if (day !== null && /^\d+$/.test(day)) f.day = Number(day)
  return f
}
