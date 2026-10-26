// Kaal Assistant (v0.8): plain questions → short answers, offline and deterministic. Every answer comes from the
// same pure functions the screens use (finder, myDay, meetings, leave, conflicts, semester), so it can never
// disagree with a grid. The role's scope (`assistantScope`, root §2) is checked before any lookup; out-of-scope
// questions are refused with what the role CAN ask. Pure: the caller passes "now".

import type { AssistantScope } from './access'
import { parseQuestion, type Parsed } from './askParse'
import { dateInfo } from './bookings'
import { freeRooms, nextFree, occupancy, weekStrip, type EntityKind } from './finder'
import type { GridView } from './gridModel'
import { bookableSlots, canMeet, inboxOf } from './meetings'
import { dayFor, localIso, nowNext } from './myDay'
import { shortDate } from './semester'
import { periodTimes } from './structure'
import { conflictReport } from '../solver/conflicts'
import type { CollegeData, Id, Placement, Room, Section, Teacher, Timetable } from '../types'

export type Jump = { label: string; view: GridView; entityId: Id }
export type MeetAction = { label: string; teacherId: Id; sectionId: Id; date: string; period: number }
export type OpenPage = 'leave' | 'conflicts' | 'meetings'
export type Answer = {
  text: string
  lines?: string[]
  jumps?: Jump[]
  open?: { label: string; page: OpenPage }[]
  actions?: MeetAction[]
  refused?: boolean
  /** No intent was recognised (the fallback). */
  unknown?: boolean
}
/** What a follow-up ("and on Friday?") may reuse. */
export type AskContext = { intent?: Intent; teacherId?: Id; sectionId?: Id; roomId?: Id }

type Intent =
  | 'help'
  | 'clashes'
  | 'unplaced'
  | 'requests'
  | 'meet'
  | 'substitutes'
  | 'holiday'
  | 'whoTeaches'
  | 'load'
  | 'booked'
  | 'freeRooms'
  | 'whenFree'
  | 'isFree'
  | 'where'

function intentOf(p: Parsed): Intent | undefined {
  const q = p.text.toLowerCase()
  if (/^\s*(help|\?|what can (you|i) ask|what do you (know|do))/.test(q)) return 'help'
  if (/\bclash|\bconflict/.test(q)) return 'clashes'
  if (/unplaced|not placed|left out|couldn'?t be placed|why .*(missing|not in)/.test(q)) return 'unplaced'
  if (/meeting requests?|any requests|requests? for me|who wants to meet/.test(q)) return 'requests'
  if (/\bmeet\b|\bmeeting\b/.test(q)) return 'meet'
  if (/substitut|\bcover(s|ing|ed)?\b|on leave|\babsent\b/.test(q)) return 'substitutes'
  if (/holiday|working day|\bday off\b|no class(es)? (on|today|tomorrow)/.test(q)) return 'holiday'
  if (/who (teaches|takes|is teaching)|teacher (of|for)|who is the teacher/.test(q)) return 'whoTeaches'
  if (/how many (periods|classes|hours|lectures)|\bload\b|workload/.test(q)) return 'load'
  if (/booked|booking|reserved/.test(q) && p.room) return 'booked'
  const freeWord = /\b(free|empty|available|vacant|unused)\b/.test(q)
  if (freeWord && !p.teacher && !p.section && !p.room && (p.roomType || /\brooms?\b|\bhalls?\b|\blabs?\b/.test(q))) return 'freeRooms'
  if (/\bwhen\b.*\bfree\b|free (slots|time|periods)/.test(q) && (p.teacher || p.section || p.room || p.self)) return 'whenFree'
  if ((freeWord || /\bbusy\b/.test(q)) && (p.teacher || p.section || p.room || p.self)) return 'isFree'
  if (/\bwhere\b|next class|\bnext\b|\bnow\b|my day|schedule|timetable|classes|what('s| is) (on|at)|teaching/.test(q)) return 'where'
  return undefined
}

const surname = (t: Teacher) => t.name.split(/\s+/).at(-1) ?? t.name

/** Example questions for a role, built from the college's real names (also the drawer's chips). */
export function suggestions(c: CollegeData, scope: AssistantScope): string[] {
  const days = c.calendar.days
  const lunchEnd = c.calendar.lunchWindow.length ? Math.max(...c.calendar.lunchWindow) : 0
  const someDay = days[Math.min(1, days.length - 1)]
  const lateDay = days[Math.min(4, days.length - 1)]
  const afterLunch = lunchEnd + 1 < c.calendar.periodsPerDay ? 'after lunch' : 'in the morning'
  if (scope.role === 'student') {
    const mine = c.assignments.filter((a) => a.sectionId === scope.sectionId && a.teacherId)
    const t = c.teachers.find((x) => x.id === mine[0]?.teacherId)
    const sub = c.subjects.find((s) => s.id === mine[0]?.subjectId)
    return [
      "What's my next class?",
      ...(t ? [`Can I meet ${surname(t)} tomorrow?`] : []),
      ...(sub ? [`Who teaches ${sub.code}?`] : []),
      'When is the next holiday?',
    ]
  }
  if (scope.role === 'teacher') {
    return ["What's my next class?", 'Any meeting requests?', 'How many periods do I have this week?', 'Who is substituting today?']
  }
  const deptTeachers = c.teachers.filter((t) => scope.role !== 'hod' || t.deptId === scope.deptId)
  const t = deptTeachers[0] ?? c.teachers[0]
  const sec = c.sections.find((s) => scope.role !== 'hod' || s.deptId === scope.deptId) ?? c.sections[0]
  const hasLab = c.rooms.some((r) => r.type === 'lab')
  return [
    ...(t ? [`Is ${surname(t)} free on ${someDay} 3rd period?`] : []),
    `Which ${hasLab ? 'labs' : 'rooms'} are free ${lateDay} ${afterLunch}?`,
    ...(sec ? [`Where is ${sec.name} now?`] : []),
    ...(scope.role === 'admin' ? ['Any clashes?'] : scope.role === 'hod' ? ['Who is substituting today?'] : ['When is the next holiday?']),
  ]
}

/** One question → one answer (and the context a follow-up may reuse). */
export function ask(c: CollegeData, scope: AssistantScope, text: string, now: Date, context: AskContext = {}): { answer: Answer; context: AskContext } {
  const p = parseQuestion(c, text, now)
  let intent = intentOf(p)
  // follow-up: "and on Friday?" reuses the last intent and entity
  const bare = !p.teacher && !p.section && !p.room && !p.subject && !p.roomType
  if (!intent && context.intent && (p.date || p.periods || /^\s*(and|what about|how about)\b/i.test(text))) intent = context.intent
  if (bare && context.intent && intent === context.intent) {
    p.teacher = c.teachers.find((t) => t.id === context.teacherId)
    p.section = c.sections.find((s) => s.id === context.sectionId)
    p.room = c.rooms.find((r) => r.id === context.roomId)
  }
  const answer = answerFor(c, scope, p, intent, now)
  return { answer, context: { intent, teacherId: p.teacher?.id, sectionId: p.section?.id, roomId: p.room?.id } }
}

// ── scope ──────────────────────────────────────────────────────────────

const teacherOk = (c: CollegeData, s: AssistantScope, t: Teacher) =>
  s.role === 'admin' || s.role === 'super'
    ? true
    : s.role === 'student'
      ? canMeet(c, s.sectionId, t.id)
      : s.role === 'teacher'
        ? t.id === s.teacherId || t.deptId === s.deptId
        : t.deptId === s.deptId || c.assignments.some((a) => a.teacherId === t.id && c.sections.some((x) => x.id === a.sectionId && x.deptId === s.deptId))

const sectionOk = (c: CollegeData, s: AssistantScope, sec: Section) =>
  s.role === 'admin' || s.role === 'super'
    ? true
    : s.role === 'student'
      ? sec.id === s.sectionId
      : s.role === 'teacher'
        ? sec.deptId === s.deptId || c.assignments.some((a) => a.sectionId === sec.id && a.teacherId === s.teacherId)
        : sec.deptId === s.deptId

const roomOk = (s: AssistantScope, r: Room) =>
  s.role === 'admin' || s.role === 'super' ? true : s.role === 'student' ? false : r.owner === 'shared' || r.owner === s.deptId

const CAN: Record<AssistantScope['role'], string> = {
  student: 'Students can ask about their own section, its teachers, meetings and holidays',
  teacher: 'Teachers can ask about their own classes, their department, meeting requests and substitutes',
  hod: 'HODs can ask about their department, its teachers and rooms, and substitutes',
  admin: 'The College Admin can ask about anything in the college',
  super: 'The Super Admin can read any college',
}
const refuse = (s: AssistantScope, c: CollegeData, why: string): Answer => ({
  text: `${why} ${CAN[s.role]} — try: “${suggestions(c, s)[0]}”`,
  refused: true,
})

// ── answers ────────────────────────────────────────────────────────────

/** The timetable this role reads: published; admins fall back to the draft. */
function sourceOf(c: CollegeData, s: AssistantScope): { tt: Timetable; note: string } | undefined {
  if (c.published) return { tt: c.published.timetable, note: '' }
  if ((s.role === 'admin' || s.role === 'super') && c.draft) return { tt: c.draft, note: ' (from the draft — nothing is published yet)' }
  return undefined
}

function answerFor(c: CollegeData, s: AssistantScope, p: Parsed, intent: Intent | undefined, now: Date): Answer {
  const today = localIso(now)
  const times = periodTimes(c.calendar)
  const days = c.calendar.days
  const at = (d: number, per: number) => `${days[d]} ${times[per]?.start ?? ''}`
  const assignments = new Map(c.assignments.map((a) => [a.id, a]))
  const subjectOf = (pl: Placement) => c.subjects.find((x) => x.id === assignments.get(pl.assignmentId)?.subjectId)
  const sectionOf = (pl: Placement) => c.sections.find((x) => x.id === assignments.get(pl.assignmentId)?.sectionId)
  const teacherOf = (pl: Placement) => c.teachers.find((x) => x.id === assignments.get(pl.assignmentId)?.teacherId)
  const roomOf = (pl: Placement) => c.rooms.find((x) => x.id === pl.roomId)
  const describe = (pl: Placement) => `${subjectOf(pl)?.name ?? '?'} (${sectionOf(pl)?.name ?? '?'}) with ${teacherOf(pl)?.name ?? 'no teacher'} in ${roomOf(pl)?.name ?? '?'}`
  const me = s.role === 'teacher' ? c.teachers.find((t) => t.id === s.teacherId) : undefined
  const mySection = s.role === 'student' ? c.sections.find((x) => x.id === s.sectionId) : undefined

  // who is the question about (teacher / section / room), with "my" meaning the asker
  const who = (): { kind: EntityKind; id: Id; name: string } | undefined => {
    if (p.teacher) return { kind: 'teacher', id: p.teacher.id, name: p.teacher.name }
    if (p.section) return { kind: 'section', id: p.section.id, name: p.section.name }
    if (p.room) return { kind: 'room', id: p.room.id, name: p.room.name }
    if (me) return { kind: 'teacher', id: me.id, name: 'You' }
    if (mySection) return { kind: 'section', id: mySection.id, name: mySection.name }
    return undefined
  }
  const check = (): Answer | null => {
    if (p.teacher && !teacherOk(c, s, p.teacher)) return refuse(s, c, `I can't share ${p.teacher.name}'s timetable with you.`)
    if (p.section && !sectionOk(c, s, p.section)) return refuse(s, c, `I can't share ${p.section.name}'s timetable with you.`)
    if (p.room && !roomOk(s, p.room)) return refuse(s, c, `Room details are not open to you.`)
    return null
  }
  const jumpFor = (kind: EntityKind, id: Id, name: string): Jump => ({ label: `Show ${name === 'You' ? 'my week' : name} in the timetable`, view: kind, entityId: id })

  switch (intent) {
    case 'help':
      return {
        text: `Ask me about free teachers and rooms, where a class is, who teaches what, substitutes, meetings and holidays — in plain words. ${CAN[s.role]}.`,
        lines: suggestions(c, s),
      }

    case 'clashes': {
      if (s.role !== 'admin' && s.role !== 'super') return refuse(s, c, 'The clash check is for the College Admin.')
      const r = conflictReport(c, today)
      if (r.clean) return { text: 'No clashes anywhere — the draft and the live version pass every hard rule, and every upcoming leave day is covered.' }
      return {
        text: `${r.draft.length} ${r.draft.length === 1 ? 'clash' : 'clashes'} in the draft, ${r.published.length} in the live version, ${r.leaveDays.length} leave ${r.leaveDays.length === 1 ? 'day needs' : 'days need'} attention.`,
        lines: [...r.draft, ...r.published].slice(0, 4).map((x) => `${x.rule} — ${x.message}`),
        open: [{ label: 'Open the Conflict Center', page: 'conflicts' }],
      }
    }

    case 'unplaced': {
      if (s.role === 'student' || s.role === 'teacher') return refuse(s, c, 'Placement problems are for the HOD and the College Admin.')
      const d = c.draft
      if (!d) return { text: 'There is no draft yet — generate one first.' }
      const list = d.unplaced.filter((u) => {
        const a = assignments.get(u.assignmentId)
        const sec = c.sections.find((x) => x.id === a?.sectionId)
        if (s.role === 'hod' && sec?.deptId !== s.deptId) return false
        return (!p.subject || a?.subjectId === p.subject.id) && (!p.section || a?.sectionId === p.section.id)
      })
      if (list.length === 0) return { text: `Nothing ${p.subject || p.section ? 'of that ' : ''}is left unplaced in the draft — every period has a slot.` }
      return {
        text: `${list.reduce((n, u) => n + u.periods, 0)} ${list.length === 1 && list[0].periods === 1 ? 'period is' : 'periods are'} not placed:`,
        lines: list.slice(0, 5).map((u) => {
          const a = assignments.get(u.assignmentId)
          return `${c.subjects.find((x) => x.id === a?.subjectId)?.code} · ${c.sections.find((x) => x.id === a?.sectionId)?.name}: ${u.reason} Fix: ${u.suggestion}`
        }),
      }
    }

    case 'requests': {
      if (s.role !== 'teacher') return refuse(s, c, 'Meeting requests are answered by each teacher.')
      const mine = inboxOf(c, s.teacherId)
      const waiting = mine.filter((m) => m.status === 'pending' || m.status === 'needsReschedule')
      const coming = mine.filter((m) => m.status === 'accepted' && m.date >= today)
      return {
        text: waiting.length ? `${waiting.length} ${waiting.length === 1 ? 'request waits' : 'requests wait'} for your answer; ${coming.length} fixed coming up.` : `Nothing waiting; ${coming.length} ${coming.length === 1 ? 'meeting' : 'meetings'} fixed coming up.`,
        lines: waiting.slice(0, 4).map((m) => `${m.studentName} (${c.sections.find((x) => x.id === m.sectionId)?.name}) — ${shortDate(m.date)} ${times[m.period]?.start}: “${m.topic}”`),
        open: [{ label: 'Open Meetings', page: 'meetings' }],
      }
    }

    case 'meet': {
      if (s.role !== 'student') return refuse(s, c, 'Meeting requests are made by students.')
      if (!p.teacher) return { text: 'Which teacher? Try: “Can I meet ' + (suggestions(c, s)[1]?.replace(/^Can I meet | tomorrow\?$/g, '') ?? 'your teacher') + ' tomorrow?”' }
      if (!canMeet(c, s.sectionId, p.teacher.id)) return refuse(s, c, `${p.teacher.name} doesn't teach your section or department.`)
      if (!c.published) return { text: 'Your college has not published a timetable yet.' }
      const date = p.date ?? today
      const slots = bookableSlots(c, p.teacher.id, s.sectionId, date, { today, minutes: now.getHours() * 60 + now.getMinutes() })
      if (slots.length === 0) return { text: `No time on ${shortDate(date)} when you and ${p.teacher.name} are both free (a holiday, a full day or already past). Try another day.` }
      return {
        text: `You and ${p.teacher.name} are both free on ${shortDate(date)} at:`,
        lines: slots.map((b) => `${b.start}–${b.end}${b.officeHour ? ' ★ office hour' : ''}`),
        actions: slots.slice(0, 4).map((b) => ({ label: `Request ${b.start}`, teacherId: p.teacher!.id, sectionId: s.sectionId, date, period: b.period })),
      }
    }

    case 'substitutes': {
      const date = p.date ?? today
      const subs = c.substitutions
        .filter((x) => x.date === date)
        .filter((x) => {
          const sec = c.sections.find((y) => y.id === assignments.get(x.assignmentId)?.sectionId)
          if (s.role === 'student') return sec?.id === s.sectionId
          if (s.role === 'teacher' || s.role === 'hod') return sec?.deptId === s.deptId || x.substituteTeacherId === (s.role === 'teacher' ? s.teacherId : '')
          return true
        })
        .sort((a, b) => a.period - b.period)
      const name = (id: Id | null) => c.teachers.find((t) => t.id === id)?.name
      if (subs.length === 0) return { text: `No substitutions ${date === today ? 'today' : `on ${shortDate(date)}`} — everyone teaches their own classes.` }
      return {
        text: `${subs.length} ${subs.length === 1 ? 'class is' : 'classes are'} covered ${date === today ? 'today' : `on ${shortDate(date)}`}:`,
        lines: subs.map((x) => {
          const a = assignments.get(x.assignmentId)
          const what = `${times[x.period]?.start} ${c.subjects.find((y) => y.id === a?.subjectId)?.code} · ${c.sections.find((y) => y.id === a?.sectionId)?.name}`
          return x.substituteTeacherId ? `${what}: ${name(x.substituteTeacherId)} for ${name(x.originalTeacherId)}` : `${what}: no one free (${name(x.originalTeacherId)} on leave)`
        }),
        ...(s.role === 'hod' || s.role === 'admin' ? { open: [{ label: 'Open Leave', page: 'leave' as const }] } : {}),
      }
    }

    case 'holiday': {
      if (p.date) {
        const info = dateInfo(c, p.date)
        if (p.date < c.semester.startDate || p.date > c.semester.endDate) return { text: `${shortDate(p.date)} is outside the semester.` }
        if (!info || info.day === null) return { text: `${shortDate(p.date)} is not a working day.` }
        if (info.status === 'holiday') return { text: `Yes — ${shortDate(p.date)} is a holiday: ${info.label}. No classes.` }
        if (info.status === 'noClass') return { text: `${shortDate(p.date)}: ${info.label} — no regular classes.` }
        return { text: `No — ${shortDate(p.date)} (${days[info.day]}) is a normal teaching day.` }
      }
      const next = c.semester.holidays.filter((h) => h.date >= today).sort((a, b) => a.date.localeCompare(b.date))
      if (next.length === 0) return { text: 'No more holidays this semester.' }
      return { text: `The next holiday is ${next[0].label} on ${shortDate(next[0].date)}.`, lines: next.slice(1, 4).map((h) => `${shortDate(h.date)} — ${h.label}`) }
    }

    case 'whoTeaches': {
      const bad = check()
      if (bad) return bad
      const section = p.section ?? mySection
      if (!p.subject && !section) return { text: 'Which subject or section? Try: “Who teaches DS to CSE-Y2-A?”' }
      const rows = c.assignments.filter(
        (a) => (!p.subject || c.subjects.find((x) => x.id === a.subjectId)?.code === p.subject.code) && (!section || a.sectionId === section.id),
      )
      const visible = rows.filter((a) => {
        const sec = c.sections.find((x) => x.id === a.sectionId)
        return sec && sectionOk(c, s, sec)
      })
      if (visible.length === 0) return { text: rows.length ? 'Not in the part of the college you can see.' : 'I could not find that subject for that section.' }
      return {
        text: p.subject ? `${p.subject.name} (${p.subject.code}):` : `${section!.name}'s teachers:`,
        lines: visible.slice(0, 8).map((a) => {
          const sub = c.subjects.find((x) => x.id === a.subjectId)
          return `${p.subject ? c.sections.find((x) => x.id === a.sectionId)?.name : `${sub?.code} ${sub?.name}`}: ${c.teachers.find((t) => t.id === a.teacherId)?.name ?? 'no teacher yet'}`
        }),
      }
    }

    case 'load': {
      const bad = check()
      if (bad) return bad
      if (s.role === 'student') return refuse(s, c, 'Teacher loads are not open to students.')
      const t = p.teacher ?? me
      if (!t) return { text: 'Whose load? Try: “How many periods does ' + surname(c.teachers[0]) + ' have this week?”' }
      const src = sourceOf(c, s)
      if (!src) return { text: 'Nothing is published yet.' }
      const per = days.map(() => 0)
      for (const pl of src.tt.placements) if (assignments.get(pl.assignmentId)?.teacherId === t.id) per[pl.day] += pl.length
      const week = per.reduce((a, b) => a + b, 0)
      const peak = Math.max(...per)
      return {
        text: `${t.id === me?.id ? 'You have' : `${t.name} has`} ${week} ${week === 1 ? 'period' : 'periods'} a week (limit ${t.maxPerWeek}); busiest day ${days[per.indexOf(peak)]} with ${peak} (limit ${t.maxPerDay})${src.note}.`,
        lines: [days.map((d, i) => `${d} ${per[i]}`).join(' · ')],
        jumps: [jumpFor('teacher', t.id, t.id === me?.id ? 'You' : t.name)],
      }
    }

    case 'booked': {
      const bad = check()
      if (bad) return bad
      const room = p.room!
      const src = sourceOf(c, s)
      if (!src) return { text: 'Nothing is published yet.' }
      const day = p.day
      const classes = src.tt.placements.filter((pl) => pl.roomId === room.id && (day === undefined || pl.day === day)).sort((a, b) => a.day - b.day || a.period - b.period)
      const bookings = (c.bookings ?? []).filter((b) => b.roomId === room.id && b.status === 'approved' && (!p.date || b.date === p.date) && b.date >= today)
      return {
        text: `${room.name}${day !== undefined ? ` on ${days[day]}` : ' this week'}: ${classes.length ? `${classes.length} ${classes.length === 1 ? 'class' : 'classes'}` : 'no classes'}${bookings.length ? ` and ${bookings.length} day ${bookings.length === 1 ? 'booking' : 'bookings'}` : ''}${src.note}.`,
        lines: [
          ...classes.slice(0, 8).map((pl) => `${at(pl.day, pl.period)} — ${subjectOf(pl)?.code} · ${sectionOf(pl)?.name}`),
          ...bookings.map((b) => `${shortDate(b.date)} ${b.periods.map((x) => times[x]?.start).join(', ')} — booked: ${b.purpose}`),
        ],
        jumps: [jumpFor('room', room.id, room.name)],
      }
    }

    case 'freeRooms': {
      if (s.role === 'student') return refuse(s, c, 'Free-room search is for teachers and admins.')
      const src = sourceOf(c, s)
      if (!src) return { text: 'Nothing is published yet.' }
      const day = p.day
      const periods = p.periods
      if (day === undefined || !periods?.length)
        return { text: `Tell me when — e.g. “Which ${p.roomType === 'lab' ? 'labs' : 'rooms'} are free ${days[0]} 3rd period?” or “… now”.` }
      const deptId = s.role === 'hod' || s.role === 'teacher' ? s.deptId : undefined
      const list = freeRooms(c, occupancy(c, src.tt), day, periods, { type: p.roomType, minCapacity: p.minSeats, forDeptId: deptId }).filter((f) => s.role === 'admin' || s.role === 'super' || roomOk(s, f.room) || f.usable === 'needs-grant')
      const when = `${days[day]} ${periods.length > 1 ? `${times[periods[0]].start}–${times[periods.at(-1)!].end}` : times[periods[0]].start}`
      const kind = p.roomType === 'lab' ? 'labs' : p.roomType === 'seminar' ? 'seminar rooms' : p.roomType === 'lecture' ? 'lecture rooms' : 'rooms'
      if (list.length === 0) return { text: `No ${kind}${p.minSeats ? ` with ${p.minSeats}+ seats` : ''} are free for all of ${when}${src.note}.` }
      const owner = (r: Room) => c.departments.find((d) => d.id === r.owner)?.code ?? ''
      const tag = (f: (typeof list)[number]) =>
        f.usable === 'own' ? 'your department' : f.usable === 'shared' ? 'shared' : f.usable === 'granted' ? 'on loan to you' : f.usable === 'needs-grant' ? `${owner(f.room)} — ask its HOD` : owner(f.room)
      return {
        text: `${list.length} ${kind} free for all of ${when}${src.note}:`,
        lines: list.map((f) => `${f.room.name} · ${f.room.capacity} seats${tag(f) ? ` · ${tag(f)}` : ''}`),
      }
    }

    case 'whenFree':
    case 'isFree': {
      const bad = check()
      if (bad) return bad
      if (p.room && s.role === 'student') return refuse(s, c, 'Room details are not open to you.')
      const x = who()
      if (!x) return { text: 'Who or what? Try: “' + suggestions(c, s)[0] + '”' }
      const src = sourceOf(c, s)
      if (!src) return { text: 'Nothing is published yet.' }
      const strip = weekStrip(c, occupancy(c, src.tt), x.kind, x.id)
      const subject = x.name === 'You' ? 'you are' : `${x.name} is`
      const day = p.day
      if (p.date && p.day === undefined) return { text: `${shortDate(p.date)} is not a working day.` }
      // that date's leave makes a teacher away all day
      if (x.kind === 'teacher' && p.date && c.leaves.some((l) => l.teacherId === x.id && l.date === p.date && l.status === 'approved'))
        return { text: `${x.name === 'You' ? 'You are' : `${x.name} is`} on leave on ${shortDate(p.date)}.` }
      const holiday = p.date ? dateInfo(c, p.date) : undefined
      if (holiday && holiday.status !== 'teaching') return { text: `${shortDate(p.date!)} has no classes (${holiday.label ?? 'not a teaching day'}) — everyone is free.` }
      const busyWith = (d: number, per: number) =>
        src.tt.placements.find((pl) => pl.day === d && per >= pl.period && per < pl.period + pl.length && (x.kind === 'room' ? pl.roomId === x.id : x.kind === 'section' ? assignments.get(pl.assignmentId)?.sectionId === x.id : assignments.get(pl.assignmentId)?.teacherId === x.id))
      const dutyAt = (per: number) => (x.kind === 'teacher' && p.date ? c.substitutions.find((y) => y.date === p.date && y.period === per && y.substituteTeacherId === x.id) : undefined)
      const freeAt = (d: number, per: number) => strip[d]?.[per] === 'free' && !dutyAt(per)
      if (intent === 'whenFree' || !p.periods?.length) {
        if (day === undefined) return { text: `Which day? Try: “When is ${x.name === 'You' ? 'I' : x.name} free on ${days[0]}?”` }
        const free = times.filter((t) => freeAt(day, t.index))
        return {
          text: free.length ? `${x.name === 'You' ? 'You are' : `${x.name} is`} free on ${days[day]}${p.date ? ` (${shortDate(p.date)})` : ''} at:` : `${x.name === 'You' ? 'You have' : `${x.name} has`} no free slot on ${days[day]}.`,
          lines: free.length ? [free.map((t) => t.start).join(' · ')] : undefined,
          jumps: [jumpFor(x.kind, x.id, x.name)],
        }
      }
      const d = day
      if (d === undefined) return { text: p.now ? 'Classes are not on right now.' : `Which day? Try adding a day, e.g. “… on ${days[0]}”.` }
      const per = p.periods[0]
      if (freeAt(d, per)) {
        const later = times.filter((t) => t.index > per && freeAt(d, t.index)).length
        return { text: `Yes — ${subject} free on ${at(d, per)}${src.note}.${later ? '' : ' It is the last free slot that day.'}`, jumps: [jumpFor(x.kind, x.id, x.name)] }
      }
      const state = strip[d]?.[per]
      const pl = busyWith(d, per)
      const duty = dutyAt(per)
      const nf = nextFree(strip, { day: d, period: per })
      const why = duty
        ? 'on substitution duty then'
        : pl
          ? `busy — ${describe(pl)}`
          : state === 'break'
            ? 'on a break / blocked slot then'
            : state === 'unavailable'
              ? 'marked unavailable then'
              : 'busy then'
      return {
        text: `No — ${subject} ${why} (${at(d, per)}).${nf ? ` Next free: ${at(nf.day, nf.period)}.` : ''}`,
        jumps: [jumpFor(x.kind, x.id, x.name)],
      }
    }

    case 'where': {
      const bad = check()
      if (bad) return bad
      if (p.room && !p.section && !p.teacher) {
        if (!roomOk(s, p.room)) return refuse(s, c, 'Room details are not open to you.')
      }
      const x = p.teacher ? { kind: 'teacher' as const, id: p.teacher.id, name: p.teacher.name } : p.section ? { kind: 'section' as const, id: p.section.id, name: p.section.name } : who()
      if (!x || x.kind === 'room') return { text: 'Whose class? Try: “' + suggestions(c, s)[0] + '”' }
      if (!c.published && s.role !== 'admin' && s.role !== 'super') return { text: 'Your college has not published a timetable yet.' }
      if (!c.published) return { text: 'Nothing is published yet — the day view reads the published version.' }
      const whoArg = { kind: x.kind, id: x.id } as { kind: 'teacher' | 'section'; id: Id }
      const date = p.date ?? today
      const label = x.name === 'You' ? 'You' : x.name
      // "classes / schedule / my day" asks for the list; "now / next" (or nothing about the day) for Now / Next
      const wantsList = /my day|schedule|classes|lectures|timetable/.test(p.text.toLowerCase()) && !p.now && !/\bnext\b/.test(p.text.toLowerCase())
      if (date === today && (p.now || (!p.periods?.length && !wantsList))) {
        const nn = nowNext(c, now, whoArg)!
        const nextLine = nn.next ? `Next: ${nn.next.subject.name} at ${nn.next.start} in ${nn.next.room?.name ?? '?'}${x.kind === 'section' ? ` with ${nn.next.teacher?.name ?? 'no teacher'}` : ` (${nn.next.section.name})`}.` : 'Nothing more today.'
        const nowText =
          nn.now.kind === 'class'
            ? `Now: ${nn.now.cls.subject.name} in ${nn.now.cls.room?.name ?? '?'}${x.kind === 'section' ? ` with ${nn.now.cls.teacher?.name ?? 'no teacher'}` : ` (${nn.now.cls.section.name})`} until ${nn.now.until}${nn.now.cls.kind === 'covered' ? ' — a substitute today' : ''}.`
            : nn.now.kind === 'break'
              ? `Now: ${nn.now.label} until ${nn.now.until}.`
              : nn.now.kind === 'free'
                ? 'Now: a free period.'
                : nn.now.kind === 'before'
                  ? 'Classes have not started yet.'
                  : nn.now.kind === 'after'
                    ? 'Done for today.'
                    : nn.day.status === 'holiday'
                      ? `No classes today — ${nn.day.label}.`
                      : nn.day.status === 'outside'
                        ? 'The semester is not on today.'
                        : 'No classes today.'
        return {
          text: `${label === 'You' ? '' : `${label} — `}${nowText} ${nn.now.kind === 'after' || nn.now.kind === 'noClasses' ? '' : nextLine}`.trim(),
          jumps: [jumpFor(x.kind, x.id, x.name)],
        }
      }
      const day = dayFor(c, date, whoArg)!
      if (day.status !== 'teaching') return { text: `${shortDate(date)}: ${day.status === 'holiday' ? `holiday — ${day.label}` : day.status === 'noClass' ? `${day.label}, no regular classes` : day.status === 'outside' ? 'outside the semester' : 'not a working day'}.` }
      const list = day.classes.filter((k) => !p.periods?.length || p.periods.some((per) => per >= k.placement.period && per < k.placement.period + k.placement.length))
      if (list.length === 0) return { text: `${label === 'You' ? 'You have' : `${label} has`} no class ${p.periods?.length ? `at ${times[p.periods[0]].start}` : ''} on ${shortDate(date)}.`.replace('  ', ' ') }
      return {
        text: `${label === 'You' ? 'Your' : `${label}'s`} classes on ${shortDate(date)}:`,
        lines: list.map((k) => `${k.start} ${k.subject.name} · ${x.kind === 'section' ? (k.teacher?.name ?? 'no teacher') : k.section.name} · ${k.room?.name ?? '?'}${k.kind === 'covered' ? ' (substitute)' : k.kind === 'duty' ? ' (substitution duty)' : ''}`),
        jumps: [jumpFor(x.kind, x.id, x.name)],
      }
    }

    default:
      return {
        text: `I didn't catch that. I answer questions about free teachers and rooms, where a class is, who teaches what, substitutes, meetings and holidays. Try one of these:`,
        lines: suggestions(c, s).slice(0, 3),
        unknown: true,
      }
  }
}
