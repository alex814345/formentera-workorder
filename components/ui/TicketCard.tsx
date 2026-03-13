import { ImageIcon } from 'lucide-react'
import StatusBadge from './StatusBadge'
import type { TicketStatus } from '@/types'

interface TicketCardProps {
  id: number
  Asset: string
  locationLabel: string // "Facility: X" or "Well: X"
  Equipment: string
  Ticket_Status: TicketStatus
  Issue_Photos?: string[]
  onClick?: () => void
}

export default function TicketCard({
  Asset,
  locationLabel,
  Equipment,
  Ticket_Status,
  Issue_Photos,
  onClick,
}: TicketCardProps) {
  const hasPhoto = Issue_Photos && Issue_Photos.length > 0

  return (
    <div className="ticket-card" onClick={onClick}>
      {/* Thumbnail */}
      <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
        {hasPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={Issue_Photos[0]} alt="Issue" className="w-full h-full object-cover rounded-lg" />
        ) : (
          <ImageIcon size={24} className="text-gray-300" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">Asset: {Asset}</p>
        <p className="text-xs text-gray-500 truncate mt-0.5">{locationLabel}</p>
        <p className="text-xs text-gray-500 truncate">Equipment: {Equipment}</p>
      </div>

      {/* Status */}
      <div className="flex-shrink-0">
        <StatusBadge status={Ticket_Status} />
      </div>
    </div>
  )
}
