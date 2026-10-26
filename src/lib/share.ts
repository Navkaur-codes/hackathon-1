// Share link for one section's published week. Kaalchakra has no server, so the link carries the timetable
// itself: a small read-only snapshot compressed with lz-string into `?s=…`. Whoever opens it sees the week as
// it was when shared (labelled with its version), on any device, without the college's data.

import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import type { CollegeData, Id, Placement, Section, Subject } from '../types'
import { buildGrid, type Grid } from './gridModel'
import { shortDate } from './semester'

/** Compact on purpose: every byte ends up in the URL. */
export type ShareSnapshot = {
  v: 1
  /** College name, section name, section subtitle. */
  college: string
  section: string
  subtitle: string
  /** Semester line, e.g. "Odd Semester 2026 · 20 Jul – 27 Nov". */
  semester: string
  /** Published version and when it was published (ISO). */
  version: number
  at: string
  days: string[]
  /** [start, end] clock time of every slot. */
  rows: [string, string][]
  lunch: number[]
  /** [day, period, label] */
  breaks: [number, number, string][]
  /** [day, start, span, code, name, lab 0/1, teacher · room] */
  cells: [number, number, number, string, string, 0 | 1, string][]
}

/** Snapshot of a section's published week, or undefined when nothing is published / no such section. */
export function snapshotOf(c: CollegeData, sectionId: Id): ShareSnapshot | undefined {
  const pub = c.published
  if (!pub || !c.sections.some((s) => s.id === sectionId)) return undefined
  const g = buildGrid(c, pub.timetable, 'section', sectionId)
  return {
    v: 1,
    college: c.college.name,
    section: g.title,
    subtitle: g.subtitle,
    semester: `${c.semester.name} · ${shortDate(c.semester.startDate)} – ${shortDate(c.semester.endDate)}`,
    version: pub.version,
    at: pub.at,
    days: g.days,
    rows: g.rows.map((r) => [r.start, r.end]),
    lunch: g.rows.filter((r) => r.inLunchWindow).map((r) => r.index),
    breaks: g.breaks.map((b) => [b.day, b.period, b.label]),
    cells: g.cells.map((x) => [x.day, x.start, x.span, x.subject.code, x.subject.name, x.lab ? 1 : 0, x.detail]),
  }
}

export const encodeShare = (snap: ShareSnapshot) => compressToEncodedURIComponent(JSON.stringify(snap))

const isStr = (x: unknown): x is string => typeof x === 'string'
const isInt = (x: unknown): x is number => Number.isInteger(x) && (x as number) >= 0

/** The snapshot in a link, or null when the link is broken or not a Kaalchakra share. Never throws. */
export function decodeShare(s: string | null | undefined): ShareSnapshot | null {
  if (!s) return null
  let o: Partial<ShareSnapshot>
  try {
    o = JSON.parse(decompressFromEncodedURIComponent(s) ?? '')
  } catch {
    return null
  }
  if (!o || o.v !== 1 || ![o.college, o.section, o.subtitle, o.semester, o.at].every(isStr) || !isInt(o.version)) return null
  const days = o.days
  const rows = o.rows
  if (!Array.isArray(days) || !days.every(isStr) || !Array.isArray(rows) || !rows.every((r) => Array.isArray(r) && r.length === 2 && r.every(isStr))) return null
  const inGrid = (d: unknown, p: unknown, span = 1) => isInt(d) && isInt(p) && d < days.length && p + span <= rows.length
  if (!Array.isArray(o.lunch) || !o.lunch.every((p) => isInt(p) && p < rows.length)) return null
  if (!Array.isArray(o.breaks) || !o.breaks.every((b) => Array.isArray(b) && inGrid(b[0], b[1]) && isStr(b[2]))) return null
  const cellOk = (x: unknown) =>
    Array.isArray(x) && x.length === 7 && isInt(x[2]) && x[2] >= 1 && inGrid(x[0], x[1], x[2]) && isStr(x[3]) && isStr(x[4]) && (x[5] === 0 || x[5] === 1) && isStr(x[6])
  if (!Array.isArray(o.cells) || !o.cells.every(cellOk)) return null
  return o as ShareSnapshot
}

/** A link that opens the shared week (`?s=…`) on `base` (the app's address). */
export const shareUrl = (base: string, snap: ShareSnapshot) => `${base}?s=${encodeShare(snap)}`

/** The grid drawn from a snapshot — same component as everywhere else, no college data needed. */
export function snapshotGrid(snap: ShareSnapshot): Grid {
  const section = { id: 'shared', collegeId: '', deptId: '', programmeId: '', name: snap.section, strength: 0 } satisfies Section
  return {
    view: 'section',
    entityId: 'shared',
    title: snap.section,
    subtitle: snap.subtitle,
    days: snap.days,
    rows: snap.rows.map(([start, end], index) => ({ index, start, end, inLunchWindow: snap.lunch.includes(index) })),
    breaks: snap.breaks.map(([day, period, label]) => ({ day, period, label })),
    periods: snap.cells.reduce((s, x) => s + x[2], 0),
    cells: snap.cells.map(([day, start, span, code, name, lab, detail]) => {
      const subject = {
        id: code,
        collegeId: '',
        deptId: '',
        programmeId: '',
        code,
        name,
        kind: lab ? 'lab' : 'theory',
        periodsPerWeek: 0,
        roomType: lab ? 'lab' : 'lecture',
      } satisfies Subject
      const placement = { assignmentId: `${code}@${day}-${start}`, collegeId: '', deptId: '', day, period: start, length: span, roomId: '', locked: false } satisfies Placement
      return { key: placement.assignmentId, day, start, span, placement, subject, section, teacher: null, room: null, lab: lab === 1, detail }
    }),
  }
}
