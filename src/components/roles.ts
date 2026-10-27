// Display data for the five roles (root CLAUDE.md §6 role accents). No access logic here — that is lib/access.ts.

import { Building2, GraduationCap, Landmark, School, Users, type LucideIcon } from 'lucide-react'
import type { Role } from '../types'

export type RoleMeta = { role: Role; name: string; short: string; accent: string; icon: LucideIcon; line: string }

export const ROLES: RoleMeta[] = [
  {
    role: 'superAdmin',
    name: 'Super Admin',
    short: 'Super',
    accent: 'var(--gold)',
    icon: Landmark,
    line: 'Creates colleges and gives each College Admin a username and password.',
  },
  {
    role: 'collegeAdmin',
    name: 'College Admin',
    short: 'College',
    accent: 'var(--vermilion)',
    icon: Building2,
    line: 'Shapes the college — calendar, departments, subjects — then generates and publishes one clash-free timetable.',
  },
  {
    role: 'deptAdmin',
    name: 'Head of Department',
    short: 'HOD',
    accent: 'var(--terracotta)',
    icon: School,
    line: 'Plans the department, lends idle rooms, handles leave and substitutes.',
  },
  {
    role: 'teacher',
    name: 'Teacher',
    short: 'Teacher',
    accent: 'var(--plum)',
    icon: Users,
    line: 'Sees the week at a glance, requests leave, answers meeting requests.',
  },
  {
    role: 'student',
    name: 'Student',
    short: 'Student',
    accent: 'var(--marigold)',
    icon: GraduationCap,
    line: 'Knows where the next class is — and when a teacher is free to meet.',
  },
]

export const roleMeta = (role: Role): RoleMeta => ROLES.find((r) => r.role === role)!
