// Two demo colleges of deliberately different shapes. They are plain structure specs fed through
// `buildCollege` — the same path a Super Admin's Structure Builder uses (rule G3). Nothing in the app
// may depend on these names or counts.

import { buildCollege, type CollegeSpec } from './lib/structure'
import type { CollegeData } from './types'

/** Engineering: 6 days × 7 slots, three departments, staggered lunch, shared labs and seminar hall. */
export const engineeringSpec: CollegeSpec = {
  code: 'DIET',
  name: 'Demo Institute of Engineering & Technology',
  calendar: {
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    weekdays: [1, 2, 3, 4, 5, 6],
    periodsPerDay: 7,
    startTime: '09:00',
    periodMinutes: 50,
    // College default lunch is the 4th slot; ECE overrides it to the 5th (staggered canteen rush).
    breaks: [{ period: 3, label: 'Lunch' }],
    lunchWindow: [3, 4],
    teacherMinFreeInLunchWindow: 1,
    blockedSlots: [],
    labBlockLength: 2,
    maxMeetingRequestsPerStudent: 3,
  },
  semester: {
    name: 'Odd Semester 2026',
    startDate: '2026-07-20',
    endDate: '2026-11-27',
    holidays: [
      { date: '2026-08-15', label: 'Independence Day' },
      { date: '2026-10-02', label: 'Gandhi Jayanti' },
      { date: '2026-10-20', label: 'Dussehra' },
      { date: '2026-11-09', label: 'Diwali break' },
      { date: '2026-11-10', label: 'Diwali break' },
      { date: '2026-11-24', label: 'Guru Nanak Jayanti' },
    ],
    noClassDates: [{ date: '2026-09-21', label: 'Mid-semester exams' }, { date: '2026-09-22', label: 'Mid-semester exams' }],
  },
  sharedRooms: [
    { name: 'CL-1 Computer Lab', type: 'lab', capacity: 60 },
    { name: 'CL-2 Computer Lab', type: 'lab', capacity: 60 },
    { name: 'Seminar Hall', type: 'seminar', capacity: 150 },
  ],
  departments: [
    {
      code: 'CSE',
      name: 'Computer Science & Engineering',
      rooms: [
        { name: 'LT-101', type: 'lecture', capacity: 70 },
        { name: 'LT-102', type: 'lecture', capacity: 70 },
        { name: 'CSE Project Lab', type: 'lab', capacity: 60 },
      ],
      teachers: [
        { key: 'kaur', name: 'Dr. Harpreet Kaur', maxPerDay: 4, maxPerWeek: 18 },
        { key: 'bedi', name: 'Prof. Aman Bedi', maxPerDay: 4, maxPerWeek: 18 },
        { key: 'arora', name: 'Dr. Neha Arora', maxPerDay: 4, maxPerWeek: 18 },
        // Visiting faculty: not available on Saturdays.
        {
          key: 'sharma',
          name: 'Prof. Rohit Sharma',
          maxPerDay: 4,
          maxPerWeek: 16,
          unavailable: [0, 1, 2, 3, 4, 5, 6].map((p) => [5, p] as [number, number]),
        },
        // Teaches Mathematics to CSE, ECE and ME.
        { key: 'gill', name: 'Dr. Manjit Gill', maxPerDay: 4, maxPerWeek: 18 },
        // Teaches Professional Communication in the shared seminar hall to all three departments.
        { key: 'walia', name: 'Ms. Simran Walia', maxPerDay: 3, maxPerWeek: 12 },
      ],
      programmes: [
        {
          name: 'B.Tech CSE — Year 2',
          shortName: 'Y2',
          sectionsCount: 2,
          defaultStrength: 60,
          subjects: [
            { code: 'DS', name: 'Data Structures', kind: 'theory', periodsPerWeek: 4, teachers: ['kaur', 'bedi'] },
            { code: 'DBMS', name: 'Database Systems', kind: 'theory', periodsPerWeek: 3, teachers: ['arora'] },
            { code: 'DM', name: 'Discrete Mathematics', kind: 'theory', periodsPerWeek: 3, teachers: ['gill'] },
            { code: 'COA', name: 'Computer Organisation', kind: 'theory', periodsPerWeek: 3, teachers: ['bedi', 'kaur'] },
            { code: 'DSL', name: 'Data Structures Lab', kind: 'lab', periodsPerWeek: 2, teachers: ['kaur', 'bedi'] },
            { code: 'DBL', name: 'Database Lab', kind: 'lab', periodsPerWeek: 2, teachers: ['arora'] },
          ],
        },
        {
          name: 'B.Tech CSE — Year 3',
          shortName: 'Y3',
          sectionsCount: 1,
          defaultStrength: 55,
          subjects: [
            { code: 'OS', name: 'Operating Systems', kind: 'theory', periodsPerWeek: 4, teachers: ['sharma'] },
            { code: 'CN', name: 'Computer Networks', kind: 'theory', periodsPerWeek: 4, teachers: ['sharma'] },
            { code: 'SE', name: 'Software Engineering', kind: 'theory', periodsPerWeek: 3, teachers: ['arora'] },
            { code: 'PC', name: 'Professional Communication', kind: 'theory', periodsPerWeek: 2, roomType: 'seminar', teachers: ['walia'] },
            { code: 'OSL', name: 'Operating Systems Lab', kind: 'lab', periodsPerWeek: 2, teachers: ['sharma'] },
          ],
        },
      ],
    },
    {
      code: 'ECE',
      name: 'Electronics & Communication Engineering',
      breaks: [{ period: 4, label: 'Lunch' }],
      rooms: [
        { name: 'LT-201', type: 'lecture', capacity: 60 },
        { name: 'LT-202', type: 'lecture', capacity: 60 },
        { name: 'ECE Electronics Lab', type: 'lab', capacity: 60 },
      ],
      teachers: [
        { key: 'mehta', name: 'Dr. Kavita Mehta', maxPerDay: 4, maxPerWeek: 18 },
        { key: 'dhillon', name: 'Prof. Jaspreet Dhillon', maxPerDay: 4, maxPerWeek: 18 },
        // Not available for the first two periods on Mondays.
        { key: 'sandhu', name: 'Dr. Gurpreet Sandhu', maxPerDay: 4, maxPerWeek: 18, unavailable: [[0, 0], [0, 1]] },
      ],
      programmes: [
        {
          name: 'B.Tech ECE — Year 2',
          shortName: 'Y2',
          sectionsCount: 1,
          defaultStrength: 55,
          subjects: [
            { code: 'SS', name: 'Signals & Systems', kind: 'theory', periodsPerWeek: 4, teachers: ['mehta'] },
            { code: 'AE', name: 'Analog Electronics', kind: 'theory', periodsPerWeek: 4, teachers: ['dhillon'] },
            { code: 'EM', name: 'Engineering Mathematics', kind: 'theory', periodsPerWeek: 3, teachers: ['gill'] },
            { code: 'DE', name: 'Digital Electronics', kind: 'theory', periodsPerWeek: 3, teachers: ['mehta'] },
            { code: 'AEL', name: 'Analog Electronics Lab', kind: 'lab', periodsPerWeek: 2, teachers: ['dhillon'] },
          ],
        },
        {
          name: 'B.Tech ECE — Year 3',
          shortName: 'Y3',
          sectionsCount: 1,
          defaultStrength: 50,
          subjects: [
            { code: 'CS', name: 'Communication Systems', kind: 'theory', periodsPerWeek: 4, teachers: ['sandhu'] },
            { code: 'MP', name: 'Microprocessors', kind: 'theory', periodsPerWeek: 4, teachers: ['dhillon'] },
            { code: 'VLSI', name: 'VLSI Design', kind: 'theory', periodsPerWeek: 3, teachers: ['sandhu'] },
            { code: 'PC', name: 'Professional Communication', kind: 'theory', periodsPerWeek: 2, roomType: 'seminar', teachers: ['walia'] },
            { code: 'MPL', name: 'Microprocessors Lab', kind: 'lab', periodsPerWeek: 2, teachers: ['sandhu'] },
          ],
        },
      ],
    },
    {
      code: 'ME',
      name: 'Mechanical Engineering',
      rooms: [
        { name: 'LT-301', type: 'lecture', capacity: 65 },
        { name: 'LT-302', type: 'lecture', capacity: 65 },
        { name: 'ME Workshop', type: 'lab', capacity: 60 },
      ],
      teachers: [
        { key: 'grewal', name: 'Prof. Baljit Grewal', maxPerDay: 4, maxPerWeek: 18 },
        { key: 'chahal', name: 'Dr. Ritu Chahal', maxPerDay: 4, maxPerWeek: 18 },
        { key: 'brar', name: 'Prof. Inder Brar', maxPerDay: 4, maxPerWeek: 18 },
      ],
      programmes: [
        {
          name: 'B.Tech ME — Year 2',
          shortName: 'Y2',
          sectionsCount: 1,
          defaultStrength: 60,
          subjects: [
            { code: 'TD', name: 'Thermodynamics', kind: 'theory', periodsPerWeek: 4, teachers: ['grewal'] },
            { code: 'SOM', name: 'Strength of Materials', kind: 'theory', periodsPerWeek: 4, teachers: ['chahal'] },
            { code: 'EM', name: 'Engineering Mathematics', kind: 'theory', periodsPerWeek: 3, teachers: ['gill'] },
            { code: 'MFG', name: 'Manufacturing Processes', kind: 'theory', periodsPerWeek: 3, teachers: ['grewal'] },
            { code: 'WSL', name: 'Workshop Practice', kind: 'lab', periodsPerWeek: 2, teachers: ['chahal'] },
          ],
        },
        {
          name: 'B.Tech ME — Year 3',
          shortName: 'Y3',
          sectionsCount: 1,
          defaultStrength: 45,
          subjects: [
            { code: 'HT', name: 'Heat Transfer', kind: 'theory', periodsPerWeek: 4, teachers: ['brar'] },
            { code: 'MD', name: 'Machine Design', kind: 'theory', periodsPerWeek: 4, teachers: ['brar'] },
            { code: 'FM', name: 'Fluid Mechanics', kind: 'theory', periodsPerWeek: 3, teachers: ['chahal'] },
            { code: 'PC', name: 'Professional Communication', kind: 'theory', periodsPerWeek: 2, roomType: 'seminar', teachers: ['walia'] },
            { code: 'CADL', name: 'CAD Lab', kind: 'lab', periodsPerWeek: 2, teachers: ['brar'] },
          ],
        },
      ],
    },
  ],
}

/** Arts & Science: 5 days × 6 slots, two departments, short common lunch, extra Friday break. */
export const artsScienceSpec: CollegeSpec = {
  code: 'DCAS',
  name: 'Demo College of Arts & Science',
  calendar: {
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    weekdays: [1, 2, 3, 4, 5],
    periodsPerDay: 6,
    startTime: '09:30',
    periodMinutes: 55,
    periodLengths: [55, 55, 30, 55, 55, 55],
    breaks: [
      { period: 2, label: 'Lunch' },
      { period: 3, days: [4], label: 'Friday assembly' },
    ],
    lunchWindow: [2, 3],
    teacherMinFreeInLunchWindow: 1,
    blockedSlots: [],
    labBlockLength: 2,
    maxMeetingRequestsPerStudent: 2,
  },
  semester: {
    name: 'Semester I 2026–27',
    startDate: '2026-08-03',
    endDate: '2026-11-20',
    holidays: [
      { date: '2026-08-15', label: 'Independence Day' },
      { date: '2026-08-28', label: 'Raksha Bandhan' },
      { date: '2026-10-02', label: 'Gandhi Jayanti' },
      { date: '2026-10-20', label: 'Dussehra' },
      { date: '2026-11-09', label: 'Diwali break' },
      { date: '2026-11-10', label: 'Diwali break' },
    ],
    noClassDates: [{ date: '2026-10-08', label: 'Annual cultural fest' }],
  },
  sharedRooms: [
    { name: 'Language & Computer Lab', type: 'lab', capacity: 60 },
    { name: 'Auditorium', type: 'seminar', capacity: 120 },
  ],
  departments: [
    {
      code: 'COM',
      name: 'Commerce',
      rooms: [
        { name: 'Room C1', type: 'lecture', capacity: 60 },
        { name: 'Room C2', type: 'lecture', capacity: 60 },
      ],
      teachers: [
        { key: 'verma', name: 'Dr. Anjali Verma', maxPerDay: 4, maxPerWeek: 18 },
        { key: 'khanna', name: 'Prof. Vikram Khanna', maxPerDay: 4, maxPerWeek: 18 },
        { key: 'bajwa', name: 'Ms. Ravneet Bajwa', maxPerDay: 4, maxPerWeek: 16 },
      ],
      programmes: [
        {
          name: 'B.Com — Year 1',
          shortName: 'Y1',
          sectionsCount: 2,
          defaultStrength: 50,
          subjects: [
            { code: 'FA', name: 'Financial Accounting', kind: 'theory', periodsPerWeek: 4, teachers: ['verma', 'khanna'] },
            { code: 'BE', name: 'Business Economics', kind: 'theory', periodsPerWeek: 4, teachers: ['bajwa', 'verma'] },
            { code: 'BL', name: 'Business Law', kind: 'theory', periodsPerWeek: 3, teachers: ['khanna', 'verma'] },
            // Taught by the English department.
            { code: 'BC', name: 'Business Communication', kind: 'theory', periodsPerWeek: 3, teachers: ['pannu'] },
            { code: 'CAL', name: 'Computer Applications Lab', kind: 'lab', periodsPerWeek: 2, teachers: ['bajwa'] },
          ],
        },
        {
          name: 'B.Com — Year 2',
          shortName: 'Y2',
          sectionsCount: 1,
          defaultStrength: 45,
          subjects: [
            { code: 'CA', name: 'Cost Accounting', kind: 'theory', periodsPerWeek: 4, teachers: ['verma'] },
            { code: 'IT', name: 'Income Tax', kind: 'theory', periodsPerWeek: 4, teachers: ['khanna'] },
            { code: 'MKT', name: 'Principles of Marketing', kind: 'theory', periodsPerWeek: 3, teachers: ['bajwa'] },
            { code: 'TL', name: 'Tally Lab', kind: 'lab', periodsPerWeek: 2, teachers: ['bajwa'] },
          ],
        },
      ],
    },
    {
      code: 'ENG',
      name: 'English',
      rooms: [{ name: 'Room E1', type: 'lecture', capacity: 50 }],
      teachers: [
        { key: 'pannu', name: 'Dr. Parminder Pannu', maxPerDay: 4, maxPerWeek: 16 },
        { key: 'kang', name: 'Ms. Jasleen Kang', maxPerDay: 4, maxPerWeek: 16 },
      ],
      programmes: [
        {
          name: 'BA English — Year 1',
          shortName: 'Y1',
          sectionsCount: 1,
          defaultStrength: 40,
          subjects: [
            { code: 'POE', name: 'British Poetry', kind: 'theory', periodsPerWeek: 4, teachers: ['pannu'] },
            { code: 'IWE', name: 'Indian Writing in English', kind: 'theory', periodsPerWeek: 4, teachers: ['kang'] },
            { code: 'GRM', name: 'Grammar & Usage', kind: 'theory', periodsPerWeek: 3, teachers: ['kang'] },
            { code: 'PHL', name: 'Phonetics Lab', kind: 'lab', periodsPerWeek: 2, teachers: ['pannu'] },
          ],
        },
      ],
    },
  ],
}

export const demoSpecs: CollegeSpec[] = [engineeringSpec, artsScienceSpec]

export function buildDemoColleges(): CollegeData[] {
  return demoSpecs.map(buildCollege)
}
