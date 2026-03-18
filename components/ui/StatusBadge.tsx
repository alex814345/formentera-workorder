import type { TicketStatus } from '@/types'

const STATUS_EMOJI: Record<string, string> = {
  'Open':           '🟢',
  'Backlogged':     '🟡',
  'In Progress':    '🟣',
  'Awaiting Cost':  '⚫',
  'Closed':         '🔴',
}

export default function StatusBadge({ status }: { status: TicketStatus }) {
  const emoji = STATUS_EMOJI[status] ?? '⚪'
  return (
    <span className="status-pill">
      {status} {emoji}
    </span>
  )
}
