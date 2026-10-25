import { SlotGrid } from '../../../components/SlotGrid'
import { toggleBlocked } from '../../../lib/edit'
import type { CollegeData } from '../../../types'
import type { Edit } from './tabs'

/** College-wide slots where nothing may be scheduled — assembly, sports hour, a weekly meeting (rule H7). */
export function BlockedTab({ college, edit }: { college: CollegeData; edit: Edit }) {
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted">
        Click a slot to block it for every section, teacher and room; click again to open it. {college.calendar.blockedSlots.length} blocked.
      </p>
      <SlotGrid
        calendar={college.calendar}
        marked={college.calendar.blockedSlots}
        markLabel="blocked"
        label="Blocked slots"
        onToggle={(k) => edit((c) => toggleBlocked(c, k))}
      />
    </div>
  )
}
