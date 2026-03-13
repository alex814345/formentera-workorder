import { cn } from '@/lib/utils'
import { STATUS_COLORS } from '@/lib/utils'
import type { TicketStatus } from '@/types'

export default function StatusBadge({ status }: { status: TicketStatus }) {
  const colors = STATUS_COLORS[status] ?? { dot: 'bg-gray-400', label: 'text-gray-600' }
  return (
    <span className="status-pill">
      {status}
      <span className={cn('w-2.5 h-2.5 rounded-full inline-block', colors.dot)} />
    </span>
  )
}
