'use client'
import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface AccordionProps {
  title: string
  defaultOpen?: boolean
  forceOpen?: boolean
  children: React.ReactNode
}

export default function Accordion({ title, defaultOpen = false, forceOpen, children }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    if (forceOpen !== undefined) setOpen(forceOpen)
  }, [forceOpen])

  return (
    <div className="border-b border-gray-200 last:border-0">
      <div className="accordion-header" onClick={() => setOpen(!open)}>
        <h3 className="accordion-title">{title}</h3>
        <div className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0">
          {open
            ? <ChevronUp size={14} className="text-white" />
            : <ChevronDown size={14} className="text-white" />
          }
        </div>
      </div>
      {open && (
        <div className="pb-3">
          <p className="text-sm text-gray-500 mb-2 cursor-pointer" onClick={() => setOpen(false)}>
            See Details
          </p>
          {children}
        </div>
      )}
      {!open && (
        <p className="text-sm text-gray-400 pb-3 cursor-pointer" onClick={() => setOpen(true)}>
          See Details
        </p>
      )}
    </div>
  )
}
