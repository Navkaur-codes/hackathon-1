// Kaal Assistant — reading a plain question (v0.8). Entities are matched against THIS college's own names (teachers,
// sections, rooms, subjects); time words come from its calendar (rule G2 / G4 — no day, period or lunch slot is
// hard-coded). Pure and deterministic: the caller passes "now".

import type { CollegeData, Room, Section, Subject, Teacher } from '../types'
import { localIso } from './myDay'
import { dayIndexOf } from './semester'
import { periodTimes } from './structure'

export type Parsed = {
  text: string
  teacher?: Teacher
  section?: Section
  room?: Room
  subject?: Subject
  roomType?: Room['type']
  minSeats?: number
  /** Real date the question is about (today, tomorrow, a weekday's next date, an explicit date). */
  date?: string
  /** Pattern day index (from the date or a weekday word). */
  day?: number
  /** Slot indexes asked about ("3rd period", "11:30", "after lunch"). */
  periods?: number[]
  /** "now" was asked. */
  now?: boolean
  /** The asker means themself ("my", "me", "I"). */
  self?: boolean
}

const TITLES = new Set(['dr', 'prof', 'professor', 'ms', 'mr', 'mrs', 'miss', 'sir', 'madam', 'maam'])
/** Short words never taken for a subject code. */
const STOP = new Set(['is', 'on', 'in', 'at', 'to', 'me', 'my', 'do', 'am', 'an', 'or', 'of', 'it', 'be', 'we', 'us', 'no', 'so', 'up', 'if', 'he', 'a', 'i', 'the', 'and', 'for', 'are', 'who', 'can', 'how', 'any', 'now', 'all'])
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth']

const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const tokensOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9:.]+/g, ' ').split(' ').filter(Boolean)

/** Levenshtein distance ≤ 1 (one typo) for words of 5+ letters — "Arroa" → "Arora", but "will" never becomes "Gill". */
function nearlyEqual(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1 || Math.min(a.length, b.length) < 5) return false
  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++
      j++
      continue
    }
    if (++edits > 1) return false
    if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else if (a[i + 1] === b[j] && a[i] === b[j + 1]) {
      i += 2
      j += 2
    } else {
      i++
      j++
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

/** Best teacher by name words (titles ignored): full-name matches beat surname-only, typos allowed for long words. */
export function findTeacher(c: CollegeData, words: string[]): Teacher | undefined {
  let best: { t: Teacher; score: number } | undefined
  for (const t of c.teachers) {
    const parts = tokensOf(t.name).filter((w) => !TITLES.has(w.replace(/\./g, '')) && w.length >= 3)
    let score = 0
    for (const p of parts) if (words.some((w) => w === p)) score += 3
      else if (words.some((w) => nearlyEqual(w, p))) score += 2
    if (score > 0 && (!best || score > best.score)) best = { t, score }
  }
  return best?.t
}

/** The next date (from `today`, inclusive) falling on a real weekday. */
function nextDateOn(today: string, weekday: number): string {
  const t0 = Date.parse(`${today}T00:00:00Z`)
  for (let i = 0; i < 7; i++) {
    const d = new Date(t0 + i * 86_400_000)
    if (d.getUTCDay() === weekday) return d.toISOString().slice(0, 10)
  }
  return today
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function parseQuestion(c: CollegeData, text: string, now: Date): Parsed {
  const out: Parsed = { text }
  const q = text.toLowerCase()
  const words = tokensOf(text).map((w) => w.replace(/\.$/, ''))
  const flat = compact(text)
  const today = localIso(now)
  const times = periodTimes(c.calendar)

  // ── entities (this college only) ──
  const sections = [...c.sections].sort((a, b) => compact(b.name).length - compact(a.name).length)
  out.section = sections.find((s) => flat.includes(compact(s.name)))
  const rooms = [...c.rooms].sort((a, b) => compact(b.name).length - compact(a.name).length)
  out.room =
    rooms.find((r) => flat.includes(compact(r.name))) ??
    rooms.find((r) => {
      const first = compact(r.name.split(/\s+/)[0])
      return first.length >= 3 && /\d/.test(first) && words.some((w) => compact(w) === first)
    })
  out.subject =
    c.subjects.find((s) => s.name.length >= 6 && flat.includes(compact(s.name))) ??
    c.subjects.find((s) => !STOP.has(s.code.toLowerCase()) && words.includes(s.code.toLowerCase()))
  out.teacher = findTeacher(
    c,
    words.filter((w) => !STOP.has(w)),
  )
  // a section / room name must not be read as a teacher's name
  if (out.teacher && out.section && compact(out.section.name).includes(compact(out.teacher.name.split(/\s+/).at(-1) ?? ''))) out.teacher = undefined

  if (!out.room) {
    if (/\blabs?\b|laborator/.test(q) && !(out.subject?.kind === 'lab')) out.roomType = 'lab'
    else if (/\bseminar\b|\bhall\b/.test(q)) out.roomType = 'seminar'
    else if (/\blecture\b|\bclass ?rooms?\b/.test(q)) out.roomType = 'lecture'
  }
  const seats = /(\d{2,3})\s*\+?\s*(?:seats|students|people|capacity)|(?:for|seats?)\s+(\d{2,3})\b/.exec(q)
  if (seats) out.minSeats = Number(seats[1] ?? seats[2])

  out.self = /\b(my|me|i|i'm|im|mine)\b/.test(q)

  // ── when ──
  if (/\bday after tomorrow\b/.test(q)) out.date = new Date(Date.parse(`${today}T00:00:00Z`) + 2 * 86_400_000).toISOString().slice(0, 10)
  else if (/\btomorrow\b/.test(q)) out.date = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
  else if (/\b(today|tonight)\b/.test(q)) out.date = today
  const iso = /\b(\d{4}-\d{2}-\d{2})\b/.exec(q)
  if (iso) out.date = iso[1]
  const dm = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTHS.join('|')})[a-z]*\\b|\\b(${MONTHS.join('|')})[a-z]*\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`).exec(q)
  if (dm) {
    const day = Number(dm[1] ?? dm[4])
    const month = MONTHS.indexOf((dm[2] ?? dm[3]).slice(0, 3)) + 1
    const year = Number(c.semester.startDate.slice(0, 4))
    out.date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }
  if (!out.date) {
    // a weekday word or the college's own day label ("Tue", "tuesday")
    for (let wd = 0; wd < 7; wd++) {
      const full = WEEKDAYS[wd]
      const label = c.calendar.days[c.calendar.weekdays.indexOf(wd)]?.toLowerCase()
      if (words.some((w) => w === full || w === full.slice(0, 3) || (label && w === label) || w === `${full}s`)) {
        out.date = nextDateOn(today, wd)
        break
      }
    }
  }
  if (/\bnow\b|\bright now\b|\bat the moment\b|\bcurrently\b/.test(q)) {
    out.now = true
    out.date ??= today
  }
  if (out.date) {
    const d = dayIndexOf(c.calendar, out.date)
    if (d !== null) out.day = d
  }

  // periods: "3rd period", "period 3", "p3", "third period", "11:30", "2 pm", "after / before lunch", "morning"
  const periods = new Set<number>()
  for (const m of q.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)?\s*(?:period|slot|hour)\b|\b(?:period|slot)\s*(\d{1,2})\b|\bp(\d{1,2})\b/g)) {
    const n = Number(m[1] ?? m[2] ?? m[3]) - 1
    if (n >= 0 && n < times.length) periods.add(n)
  }
  ORDINALS.forEach((o, i) => {
    if (new RegExp(`\\b${o}\\s+(period|slot|hour)\\b`).test(q) && i < times.length) periods.add(i)
  })
  for (const m of q.matchAll(/\b(\d{1,2})[:.](\d{2})\s*(am|pm)?\b|\b(\d{1,2})\s*(am|pm)\b/g)) {
    let h = Number(m[1] ?? m[4])
    const min = Number(m[2] ?? 0)
    const ap = m[3] ?? m[5]
    if (ap === 'pm' && h < 12) h += 12
    // "2:00" with no am/pm during the college day is afternoon when the day starts later
    if (!ap && h < toMin(times[0]?.start ?? '08:00') / 60 - 0.5) h += 12
    const at = h * 60 + min
    const slot = times.findIndex((t) => toMin(t.start) <= at && at < toMin(t.end))
    if (slot >= 0) periods.add(slot)
  }
  const lunch = c.calendar.lunchWindow
  if (lunch.length) {
    const last = Math.max(...lunch)
    const first = Math.min(...lunch)
    if (/\bafter lunch\b|\bafternoon\b/.test(q)) for (let p = last + 1; p < times.length; p++) periods.add(p)
    if (/\bbefore lunch\b|\bmorning\b/.test(q)) for (let p = 0; p < first; p++) periods.add(p)
    if (/\b(at|during|in) lunch\b|\blunch ?time\b/.test(q)) lunch.forEach((p) => periods.add(p))
  }
  if (out.now && periods.size === 0) {
    const at = now.getHours() * 60 + now.getMinutes()
    const slot = times.findIndex((t) => toMin(t.start) <= at && at < toMin(t.end))
    if (slot >= 0) periods.add(slot)
  }
  if (periods.size) out.periods = [...periods].sort((a, b) => a - b)
  return out
}
