import Link from 'next/link'
import { Wrench } from 'lucide-react'
import BottomNav from '@/components/layout/BottomNav'

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen pb-16">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <h1 className="text-base font-semibold text-gray-900">Work Order App</h1>
        <div className="h-0.5 w-16 bg-[#1B2E6B] mt-1" />
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pt-6">
        {/* Logo Banner */}
        <div className="w-full h-36 rounded-lg overflow-hidden mb-8 bg-gray-100 flex items-center justify-center">
          <div className="text-center">
            {/* Formentera logo text — replace with actual img tag once logo asset is available */}
            <div className="flex items-center justify-center gap-3">
              <div className="w-10 h-10 bg-[#1B2E6B] flex items-center justify-center rounded">
                <span className="text-white font-bold text-lg">F</span>
              </div>
              <span className="text-2xl font-bold tracking-widest text-[#1B2E6B]">FORMENTERA</span>
            </div>
          </div>
        </div>

        {/* Submit section */}
        <h2 className="text-lg font-bold text-gray-900 text-center mb-4">Submit a Ticket</h2>

        <Link href="/maintenance/new" className="btn-primary">
          <Wrench size={18} />
          Maintenance Ticket
        </Link>
      </div>

      <BottomNav />
    </div>
  )
}
