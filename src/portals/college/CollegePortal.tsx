import { CollegeCard } from '../../components/CollegeCard'
import type { SolveResult } from '../../solver/best'
import type { CollegeData } from '../../types'
import { PortalTitle } from '../PortalTitle'

type Props = {
  college: CollegeData
  result?: SolveResult
  onResult: (r: SolveResult) => void
  onView: () => void
}

/** College Admin of one college. Setup (P0.4-d) and generate → publish (P0.4-e) build on this shell. */
export function CollegePortal({ college, result, onResult, onView }: Props) {
  return (
    <section className="py-8">
      <PortalTitle role="collegeAdmin" title={college.college.name}>
        Your college only — set it up, generate one clash-free timetable for every department, then publish it.
      </PortalTitle>
      <div className="mt-6 max-w-2xl">
        <CollegeCard data={college} result={result} onResult={onResult} onView={onView} />
      </div>
      <p className="mt-6 max-w-2xl rounded-lg border border-dashed border-rule p-4 text-[13px] text-muted">
        Next on this desk: rooms, teachers and availability, who teaches what (or paste from Excel), then publish a version
        teachers and students follow.
      </p>
    </section>
  )
}
