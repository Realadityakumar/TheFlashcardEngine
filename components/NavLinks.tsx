'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function NavLinks() {
  const pathname = usePathname()
  const isCalendar = pathname.startsWith('/calendar')
  const isDecks = pathname.startsWith('/decks')

  const baseClass = 'text-sm text-[#8888aa] hover:text-[#f0f0ff] transition-colors duration-150 flex items-center gap-2'

  return (
    <div className="flex items-center gap-6">
      <Link
        href="/calendar"
        className={isCalendar ? `${baseClass} text-[#6c63ff]` : baseClass}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="shrink-0"
        >
          <rect x="1.5" y="2.5" width="11" height="10" rx="2" stroke="currentColor" strokeWidth="1.2" />
          <path d="M4 1.5V3.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M10 1.5V3.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M2 5.3H12" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          <rect x="4" y="7" width="2" height="2" rx="0.4" fill="currentColor" />
          <rect x="8" y="7" width="2" height="2" rx="0.4" fill="currentColor" />
        </svg>
        Calendar
      </Link>
      <Link
        href="/decks"
        className={isDecks ? `${baseClass} text-[#6c63ff]` : baseClass}
      >
        My Decks
      </Link>
    </div>
  )
}
